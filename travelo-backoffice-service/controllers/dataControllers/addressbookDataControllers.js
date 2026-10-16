const { getSequelize } = require("../../config/database");
const seyforClient = require("../integrations/seyforClient");
const { publishBackofficeEvent } = require("../../message_broker/publisher");

const sequelize = getSequelize();

// Best-effort sync to Seyfor SAOP. Greška u SAOP pozivu ne ruši lokalni
// upis — samo zabilježimo `saop_last_error` da operator vidi da nije
// sinkronizirano i može ručno re-trigger-ati.
const pushToSaop = async (AddressbookModel, addr) => {
    try {
        if (addr.saop_customer_code) {
            await seyforClient.updateCustomer(addr);
            await AddressbookModel.update(
                { saop_synced_at: new Date(), saop_last_error: null },
                { where: { uuid: addr.uuid } },
            );
            return;
        }
        // Kupac jos nije vezan na SAOP (novi, ili stari koji nikad nije
        // otvoren): prvo ga trazi po OIB-u, da se postojeci SAOP kupac veze
        // umjesto da se otvori duplikat; tek ako ga nema, otvara se novi.
        let saopCode = null;
        const oib = seyforClient.oibKupca(addr);
        if (oib) {
            try {
                const existing = await seyforClient.findCustomerByOib(oib);
                if (existing?.Code) saopCode = existing.Code;
            } catch (e) {
                console.log("seyfor findByOib error:", e.message);
            }
        }
        if (!saopCode) {
            const { code } = await seyforClient.addCustomer(addr);
            saopCode = code;
        }
        await AddressbookModel.update(
            {
                saop_customer_code: saopCode || null,
                saop_synced_at: saopCode ? new Date() : null,
                saop_last_error: saopCode ? null : "no code returned",
            },
            { where: { uuid: addr.uuid } },
        );
    } catch (e) {
        console.log("seyfor sync error:", e.message);
        try {
            await AddressbookModel.update(
                { saop_last_error: String(e.message).slice(0, 250) },
                { where: { uuid: addr.uuid } },
            );
        } catch (_) {}
    }
};

const getAddressbookDataController = async (req, res) => {
    const { AddressbookModel } = req.app.locals.models;
    try {
        await sequelize.transaction(async () => {
            const addressbookData = await AddressbookModel.findAll({
                attributes: { exclude: ["createdAt", "updatedAt"] },
                order: [["id", "ASC"]],
            });
            res.send({ status: 200, data: { addressbook: addressbookData } });
        });
    } catch (error) {
        console.log(error);
    }
};

const addAddressbookDataController = async (req, res) => {
    const { AddressbookModel } = req.app.locals.models;
    try {
        const data = req.body.body;
        const created = await sequelize.transaction(async () => {
            return await AddressbookModel.create({
                uuid: crypto.randomUUID(16),
                buyer_name: data.buyer_name,
                buyer_company_name: data.buyer_company_name,
                buyer_legal_id: data.buyer_legal_id,
                buyer_vat_id: data.buyer_vat_id,
                buyer_address: data.buyer_address,
                buyer_town: data.buyer_town,
                buyer_postal_code: data.buyer_postal_code,
                buyer_country: data.buyer_country,
                buyer_email: data.buyer_email,
                buyer_tel: data.buyer_tel,
                f2_required: data.f2_required ?? false,
                buyer_is_active: true,
            });
        });
        // Out of transaction: SAOP push je best-effort, ne smije rušiti DB.
        pushToSaop(AddressbookModel, created.toJSON());
        // Propagacija: desk/mobile osvjeze lokalni adresar na ovaj signal.
        publishBackofficeEvent("update_addressbook");
        res.send({ status: 201 });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error } });
    }
};

const updateAddressbookDataController = async (req, res) => {
    try {
        const { AddressbookModel } = req.app.locals.models;
        const data = req.body.body;
        const updated = await sequelize.transaction(async () => {
            const addressbookExist = await AddressbookModel.findOne({
                where: { uuid: data.uuid },
            });
            if (!addressbookExist) return null;
            await AddressbookModel.update(
                {
                    buyer_name: data.buyer_name,
                    buyer_company_name: data.buyer_company_name,
                    buyer_vat_id: data.buyer_vat_id,
                    buyer_address: data.buyer_address,
                    buyer_town: data.buyer_town,
                    buyer_postal_code: data.buyer_postal_code,
                    buyer_country: data.buyer_country,
                    buyer_email: data.buyer_email,
                    buyer_tel: data.buyer_tel,
                    f2_required: data.f2_required ?? false,
                    buyer_is_active: data.buyer_is_active,
                },
                { where: { uuid: data.uuid } },
            );
            return await AddressbookModel.findOne({ where: { uuid: data.uuid } });
        });
        if (!updated) {
            return res.send({ status: 404, data: { msg: "Buyer not exist" } });
        }
        pushToSaop(AddressbookModel, updated.toJSON());
        publishBackofficeEvent("update_addressbook");
        res.send({ status: 201 });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error } });
    }
};

// Write-through sa svih kanala (desk/mobile/web): kupac s OIB-om koji se izda
// na racunu upisuje se u centralni adresar. Idempotentno po OIB-u — ako vec
// postoji, popuni samo prazna/poslana polja (ne gazi postojece praznima).
// Kanali salju razlicite nazive OIB polja (buyer_vat_id / buyer_oib), pa se
// oba prihvacaju.
const upsertAddressbookDataController = async (req, res) => {
    const { AddressbookModel } = req.app.locals.models;
    try {
        const d = req.body.body || req.body || {};
        const oib = String(d.buyer_vat_id || d.buyer_oib || "").trim();
        if (!oib) {
            return res.send({ status: 400, data: { error: "OIB (buyer_vat_id) je obavezan" } });
        }
        const polja = {
            buyer_name: d.buyer_name,
            buyer_company_name: d.buyer_company_name,
            // buyer_legal_id je u portalu "OIB kupca", a buyer_vat_id "VATID".
            // Racuni/desk salju OIB kao buyer_oib/buyer_vat_id, pa bez ovoga
            // portalov OIB stupac ostaje prazan. Za HR subjekte je to isti broj,
            // pa OIB upisujemo u oba (osim ako je legal_id izricito poslan).
            buyer_legal_id: d.buyer_legal_id || oib,
            buyer_vat_id: oib,
            buyer_address: d.buyer_address,
            buyer_town: d.buyer_town,
            buyer_postal_code: d.buyer_postal_code,
            buyer_country: d.buyer_country,
            buyer_email: d.buyer_email,
            buyer_tel: d.buyer_tel,
        };
        const rez = await sequelize.transaction(async () => {
            const postoji = await AddressbookModel.findOne({ where: { buyer_vat_id: oib } });
            if (postoji) {
                const azurirano = {};
                for (const [k, v] of Object.entries(polja)) {
                    if (v !== undefined && v !== null && String(v).trim() !== "") azurirano[k] = v;
                }
                await AddressbookModel.update(azurirano, { where: { uuid: postoji.uuid } });
                const r = await AddressbookModel.findOne({ where: { uuid: postoji.uuid } });
                return { record: r, created: false };
            }
            const r = await AddressbookModel.create({
                uuid: crypto.randomUUID(),
                ...polja,
                f2_required: d.f2_required ?? false,
                buyer_is_active: true,
            });
            return { record: r, created: true };
        });
        pushToSaop(AddressbookModel, rez.record.toJSON());
        publishBackofficeEvent("update_addressbook");
        res.send({ status: 200, data: { uuid: rez.record.uuid, created: rez.created } });
    } catch (error) {
        console.log("upsertAddressbook error:", error?.message || error);
        res.send({ status: 500, data: { error: error?.message || String(error) } });
    }
};

// Uvoz adresara iz SAOP-a. SAOP je izvor istine za maticne podatke kupca
// (naziv, OIB, adresa, aktivnost); e-mail, telefon i F2 oznaka su nasi i ne
// diraju se. Kupac se veze po SAOP sifri, a nevezani lokalni kupac po OIB-u.
// Prazna vrijednost iz SAOP-a ne brise nasu. Uvoz ne salje nista natrag u
// SAOP. Uredaji dobivaju signal samo ako se nesto promijenilo.
let uvozUTijeku = null;
const uveziIzSaopa = (AddressbookModel) => {
    if (uvozUTijeku) return uvozUTijeku;
    uvozUTijeku = (async () => {
        const pocetak = Date.now();
        const saopKupci = await seyforClient.dohvatiSveKupce();
        const lokalni = (await AddressbookModel.findAll()).map((r) => r.toJSON());
        const poSifri = new Map();
        const poOib = new Map();
        for (const r of lokalni) {
            if (r.saop_customer_code) poSifri.set(String(r.saop_customer_code), r);
            else {
                const o = seyforClient.oibKupca(r);
                if (o && !poOib.has(o)) poOib.set(o, r);
            }
        }

        const sad = new Date();
        const novi = [];
        let azurirano = 0;
        let isto = 0;
        for (const c of saopKupci) {
            const sifra = String(c?.Code || "").trim();
            if (!sifra) continue;
            const naziv = String(c.Name || "").trim();
            const pravna = c.EntityType !== "F";
            const oib = String(c.TaxNumber || "").trim();
            const iz = {
                buyer_company_name: pravna ? naziv : "",
                buyer_legal_id: oib,
                buyer_vat_id: oib,
                buyer_address: String(c.Address || "").trim(),
                buyer_postal_code: String(c.PostalCode || "").trim(),
                buyer_town: String(c.City || "").trim(),
                buyer_country: c.Country ? seyforClient.drzavaNaziv(c.Country) : "",
            };
            const aktivan = String(c.Usage) !== "0";

            const postojeci = poSifri.get(sifra) || (oib && poOib.get(oib)) || null;
            if (!postojeci) {
                novi.push({
                    uuid: crypto.randomUUID(),
                    ...iz,
                    buyer_name: naziv,
                    f2_required: false,
                    buyer_is_active: aktivan,
                    saop_customer_code: sifra,
                    saop_synced_at: sad,
                    saop_last_error: null,
                });
                continue;
            }
            // Jedan lokalni kupac veze se na samo jednu SAOP sifru.
            if (oib) poOib.delete(oib);
            const promjene = {};
            for (const [k, v] of Object.entries(iz)) {
                if (v && String(postojeci[k] ?? "") !== v) promjene[k] = v;
            }
            if (!pravna && naziv && postojeci.buyer_name !== naziv) promjene.buyer_name = naziv;
            if (Boolean(postojeci.buyer_is_active) !== aktivan) promjene.buyer_is_active = aktivan;
            if (String(postojeci.saop_customer_code || "") !== sifra) promjene.saop_customer_code = sifra;
            if (!Object.keys(promjene).length) {
                isto++;
                continue;
            }
            await AddressbookModel.update(
                { ...promjene, saop_synced_at: sad, saop_last_error: null },
                { where: { uuid: postojeci.uuid } },
            );
            azurirano++;
        }
        if (novi.length) await AddressbookModel.bulkCreate(novi);
        if (novi.length || azurirano) publishBackofficeEvent("update_addressbook");
        const rez = {
            saop: saopKupci.length,
            dodano: novi.length,
            azurirano,
            bez_promjene: isto,
            trajanje_ms: Date.now() - pocetak,
        };
        console.log("adresar iz SAOP-a:", JSON.stringify(rez));
        return rez;
    })().finally(() => {
        uvozUTijeku = null;
    });
    return uvozUTijeku;
};

// POST /addressbook/saop_sync — rucno pokretanje iz portala.
const syncAddressbookFromSaopController = async (req, res) => {
    const { AddressbookModel } = req.app.locals.models;
    try {
        const rez = await uveziIzSaopa(AddressbookModel);
        res.send({ status: 200, data: rez });
    } catch (error) {
        console.log("adresar iz SAOP-a nije uvezen:", error?.message || error);
        res.send({ status: 500, data: { error: error?.message || String(error) } });
    }
};

module.exports = {
    uveziIzSaopa,
    syncAddressbookFromSaopController,
    getAddressbookDataController,
    addAddressbookDataController,
    updateAddressbookDataController,
    upsertAddressbookDataController,
};
