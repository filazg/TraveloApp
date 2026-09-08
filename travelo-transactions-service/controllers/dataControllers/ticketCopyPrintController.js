// Evidencija ispisa kopija karata + dodjela rednog broja i sufiksa.
//
// Redni broj kopije dodjeljuje poslužitelj, ne uređaj: kopije iste karte znaju
// izaći s dva mjesta (blagajna koja ju je prodala i mobilni terminal), pa bi
// svaki brojao od jedan i dvije različite kopije nosile bi isti broj.
//
// Uređaj koji je bez mreže smije brojati sam i poslati zapis naknadno; tada
// dolazi s vlastitim copy_no i poslužitelj ga zadržava. Sudar se vidi kao dvije
// kopije istog rednog broja i to je samo po sebi podatak.
const { Op } = require("sequelize");
const { getModels } = require("../../dbModels");
const { suffixKopije, procitajSuffix, MAX_KOPIJA } = require("../../helpers/ticketCopyMark");
const { VRSTE, PRAG_KOPIJA } = require("../../helpers/ticketControlTypes");

const zapisiKopiju = async ({
    ticket_uuid,
    ticket_code = null,
    copy_no = null,
    // Uredaj koji je kopiju vec otisnuo salje i oznaku s papira; zapis mora
    // nositi bas nju. Racun je isti na obje strane, ali x i z su nasumicni, pa
    // bi ponovno generiranje dalo drugu oznaku od one koju kontrolor drzi u ruci.
    suffix: suffix_s_papira = null,
    printed_at = null,
    operator_uuid = null,
    operator_name = null,
    billing_device_uuid = null,
    billing_device_name = null,
    business_premise_name = null,
    origin = null,
}) => {
    const { TicketCopyPrintModel } = getModels();
    if (!ticket_uuid) throw Object.assign(new Error("ticket_uuid je obavezan"), { status: 400 });

    // Bez proslijeđenog broja se uzima sljedeći po redu za tu kartu.
    let broj = Number(copy_no);
    if (!Number.isInteger(broj) || broj < 1) {
        const zadnji = await TicketCopyPrintModel.max("copy_no", { where: { ticket_uuid } });
        broj = (Number.isFinite(zadnji) ? zadnji : 0) + 1;
    }

    // Iznad dvadeset i cetvrte se redni broj ne da zapisati u dva hex znaka.
    // Kopija se i dalje evidentira — ispis se dogodio i to je podatak — samo joj
    // sufiks ne nosi broj, pa se na papiru vidi da je kopija ali ne i koja.
    //
    // Oznaka s uredaja ima prednost: ona je vec na papiru. Sam je racuna samo
    // pozivatelj koji je nije poslao — starije blagajne i portal koji ispis tek
    // trazi.
    const sPapira = String(suffix_s_papira || "").trim();
    const suffix = sPapira
        ? sPapira
        : (broj <= MAX_KOPIJA ? suffixKopije(ticket_uuid, broj) : null);

    // Previse kopija se vidi vec pri ispisu, ne treba cekati kontrolu. Prva i
    // druga kopija se dogadaju — izgubljena karta, zaglavljen papir. Treca je
    // uzorak, ne slucajnost.
    let flag_type = null;
    let flag_reason = null;
    if (broj >= PRAG_KOPIJA) {
        flag_type = VRSTE.MANY_COPIES;
        // Koliko ih je tocno vidi se u popisu ispisanih kopija u detalju karte.
        flag_reason = "više ispisanih kopija iste karte";
    }

    const red = await TicketCopyPrintModel.create({
        ticket_uuid,
        ticket_code,
        copy_no: broj,
        suffix,
        printed_at: printed_at ? new Date(printed_at) : new Date(),
        operator_uuid,
        operator_name,
        billing_device_uuid,
        billing_device_name,
        business_premise_name,
        origin,
        flag_type,
        flag_reason,
    });

    return {
        id: red.id,
        ticket_uuid,
        copy_no: broj,
        suffix,
        printed_at: red.printed_at,
        over_limit: broj > MAX_KOPIJA,
        flag_type,
        flag_reason,
    };
};

// Uređaj javlja da je ispisao kopiju i dobiva natrag redni broj i sufiks koji
// treba otisnuti. Prima jedan zapis ili niz — ispis kopija cijelog računa je
// jedan potez pa ide u jednom pozivu.
const logTicketCopyPrintController = async (req, res) => {
    try {
        const body = req.body?.body || req.body || {};
        const zapisi = Array.isArray(body.copies) ? body.copies : [body];
        const rezultat = [];
        for (const z of zapisi) {
            rezultat.push(await zapisiKopiju(z));
        }
        res.send({ status: 200, data: { copies: rezultat } });
    } catch (error) {
        const status = error.status || 500;
        console.log("logTicketCopyPrintController error:", error?.message || error);
        res.status(status).send({ status, data: { message: error.message } });
    }
};

// Pregled ispisanih kopija. Bez karte vraća zadnje po vremenu — za pregled u
// portalu; s kartom sve njezine kopije.
const listTicketCopyPrintsController = async (req, res) => {
    try {
        const { TicketCopyPrintModel } = getModels();
        const where = {};
        if (req.query.ticket_uuid) where.ticket_uuid = req.query.ticket_uuid;
        if (req.query.ticket_code) where.ticket_code = req.query.ticket_code;
        if (req.query.from || req.query.to) {
            where.printed_at = {};
            if (req.query.from) where.printed_at[Op.gte] = new Date(req.query.from);
            if (req.query.to) {
                const doo = new Date(req.query.to);
                doo.setHours(23, 59, 59, 999);
                where.printed_at[Op.lte] = doo;
            }
        }
        const redci = await TicketCopyPrintModel.findAll({
            where,
            order: [["printed_at", "DESC"]],
            limit: Math.min(Number(req.query.limit) || 200, 1000),
        });
        res.send({ status: 200, data: { copies: redci } });
    } catch (error) {
        console.log("listTicketCopyPrintsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    zapisiKopiju,
    procitajSuffix,
    logTicketCopyPrintController,
    listTicketCopyPrintsController,
};
