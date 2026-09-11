// Postavke MOSI veze i odluka o tome što se dojavljuje.
// Isti obrazac kao kod SEOP-a: jedan redak, portal uređuje, akd servis čita.

// oib_pu se ne upisuje ovdje: to je OIB tvrtke iz Administracija -> Tvrtka.
const DOPUSTENA = [
    "environment", "api_key_test", "api_key_prod", "id_osoba_pu",
    "enabled", "send_utrosak", "send_storno", "send_from_date", "sync_crna_lista",
];

const CERT_POLJA = [
    "p12_file", "p12_password", "p12_subject", "p12_valid_to", "p12_uploaded_at",
];

// API ključ je tajna kao i lozinka: prazno polje pri spremanju znači "ne diraj".
const TAJNE = ["api_key_test", "api_key_prod"];

async function dohvatiRedak(MosiSettingsModel) {
    const [red] = await MosiSettingsModel.findOrCreate({
        where: { id: 1 },
        defaults: { id: 1 },
    });
    return red;
}

const zaPortal = (red) => {
    const o = red.toJSON();
    o.api_key_test_postavljen = !!o.api_key_test;
    o.api_key_prod_postavljen = !!o.api_key_prod;
    o.p12_password_postavljena = !!o.p12_password;
    delete o.api_key_test;
    delete o.api_key_prod;
    delete o.p12_password;
    return o;
};

const getMosiSettingsController = async (req, res) => {
    const { MosiSettingsModel } = req.app.locals.models;
    try {
        const red = await dohvatiRedak(MosiSettingsModel);
        res.send({ status: 200, data: { settings: zaPortal(red) } });
    } catch (error) {
        console.log("getMosiSettingsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const getMosiSettingsInternalController = async (req, res) => {
    const { MosiSettingsModel } = req.app.locals.models;
    try {
        const red = await dohvatiRedak(MosiSettingsModel);
        res.send({ status: 200, data: { settings: red.toJSON() } });
    } catch (error) {
        console.log("getMosiSettingsInternalController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const updateMosiSettingsController = async (req, res) => {
    const { MosiSettingsModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const red = await dohvatiRedak(MosiSettingsModel);

        const izmjene = {};
        for (const polje of DOPUSTENA) {
            if (!(polje in data)) continue;
            if (TAJNE.includes(polje) && !String(data[polje] || "").trim()) continue;
            izmjene[polje] = data[polje] === "" ? null : data[polje];
        }

        const buduce = { ...red.toJSON(), ...izmjene };
        if (buduce.enabled && buduce.environment !== "mock") {
            const kljuc = buduce.environment === "prod" ? buduce.api_key_prod : buduce.api_key_test;
            const fali = [];
            if (!kljuc) fali.push(`API ključ za ${buduce.environment}`);
            if (!buduce.id_osoba_pu) fali.push("oznaka osobe koja dojavljuje");
            // Bez potpisnog certifikata dojava utroška ne prolazi; ostale
            // metode (katalozi, provjera statusa) se ne potpisuju.
            if (buduce.send_utrosak && !buduce.p12_file) fali.push("potpisni certifikat");
            if (fali.length) {
                return res.status(400).send({
                    status: 400,
                    data: { message: `Za uključenje nedostaje: ${fali.join(", ")}.` },
                });
            }
        }

        await red.update(izmjene);
        res.send({ status: 200, data: { settings: zaPortal(red) } });
    } catch (error) {
        console.log("updateMosiSettingsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const setMosiCertController = async (req, res) => {
    const { MosiSettingsModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const red = await dohvatiRedak(MosiSettingsModel);
        const izmjene = {};
        for (const polje of CERT_POLJA) {
            if (polje in data) izmjene[polje] = data[polje] === "" ? null : data[polje];
        }
        await red.update(izmjene);
        res.send({ status: 200, data: { settings: zaPortal(red) } });
    } catch (error) {
        console.log("setMosiCertController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    getMosiSettingsController,
    getMosiSettingsInternalController,
    updateMosiSettingsController,
    setMosiCertController,
};
