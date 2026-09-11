// Postavke SEOP veze i odluka o tome što se u SEOP šalje.
//
// Jedan redak (id = 1). Ured ih uređuje u portalu, akd servis ih čita pri
// svakoj dojavi. Prije su stajale u datoteci na poslužitelju, pa je svaka
// promjena tražila pristup stroju i restart.

// Polja koja smije mijenjati portal. Sve ostalo (opis certifikata, vrijeme
// učitavanja) upisuje akd servis pri uploadu — da se iz portala ne može
// "prepisati" koji certifikat stvarno leži na disku.
const DOPUSTENA = [
    "environment", "brodarev_oib", "lozinka",
    "enabled", "send_opk", "send_ppk", "send_cvikanje", "send_storno",
    "send_isplovljenje", "send_ponisti_cvikanje", "send_from_date",
    "ozn_pristup_tocke_source", "ozn_pristup_tocke_fixed",
    "line_no_source", "jop_source", "tls_reject_unauthorized",
];

// Polja koja upisuje akd servis nakon uploada certifikata.
const CERT_POLJA = [
    "p12_file", "p12_password", "p12_subject", "p12_valid_to", "p12_uploaded_at",
    "ca_file", "sign_cert_file",
];

async function dohvatiRedak(SeopSettingsModel) {
    const [red] = await SeopSettingsModel.findOrCreate({
        where: { id: 1 },
        defaults: { id: 1 },
    });
    return red;
}

// Portalu se lozinke ne vraćaju u čitljivom obliku — ekran treba znati samo je
// li nešto postavljeno, a ne što.
const zaPortal = (red) => {
    const o = red.toJSON();
    o.lozinka_postavljena = !!o.lozinka;
    o.p12_password_postavljena = !!o.p12_password;
    delete o.lozinka;
    delete o.p12_password;
    return o;
};

const getSeopSettingsController = async (req, res) => {
    const { SeopSettingsModel } = req.app.locals.models;
    try {
        const red = await dohvatiRedak(SeopSettingsModel);
        res.send({ status: 200, data: { settings: zaPortal(red) } });
    } catch (error) {
        console.log("getSeopSettingsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Interni dohvat za akd servis — s lozinkama, jer bez njih ne može pozvati
// SEOP. Nije izložen portalu.
const getSeopSettingsInternalController = async (req, res) => {
    const { SeopSettingsModel } = req.app.locals.models;
    try {
        const red = await dohvatiRedak(SeopSettingsModel);
        res.send({ status: 200, data: { settings: red.toJSON() } });
    } catch (error) {
        console.log("getSeopSettingsInternalController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const updateSeopSettingsController = async (req, res) => {
    const { SeopSettingsModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const red = await dohvatiRedak(SeopSettingsModel);

        const izmjene = {};
        for (const polje of DOPUSTENA) {
            if (!(polje in data)) continue;
            // Prazna lozinka znači "ne diraj", ne "obriši" — ekran je i ne
            // prikazuje, pa bi je inače svako spremanje obrisalo.
            if (polje === "lozinka" && !String(data[polje] || "").trim()) continue;
            izmjene[polje] = data[polje] === "" ? null : data[polje];
        }

        // Uključenje bez certifikata i kredencijala bi značilo da dojave odlaze
        // u prazno i trajno padaju. Bolje odbiti odmah i reći što nedostaje.
        const buduce = { ...red.toJSON(), ...izmjene };
        if (buduce.enabled && buduce.environment !== "mock") {
            const fali = [];
            if (!buduce.brodarev_oib) fali.push("OIB brodara");
            if (!buduce.lozinka) fali.push("lozinka");
            if (!buduce.p12_file) fali.push("klijentski certifikat");
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
        console.log("updateSeopSettingsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Upis opisa certifikata nakon uploada. Zove ga akd servis, koji je datoteku i
// spremio — samo on zna što na disku stvarno stoji.
const setSeopCertController = async (req, res) => {
    const { SeopSettingsModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const red = await dohvatiRedak(SeopSettingsModel);
        const izmjene = {};
        for (const polje of CERT_POLJA) {
            if (polje in data) izmjene[polje] = data[polje] === "" ? null : data[polje];
        }
        await red.update(izmjene);
        res.send({ status: 200, data: { settings: zaPortal(red) } });
    } catch (error) {
        console.log("setSeopCertController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    getSeopSettingsController,
    getSeopSettingsInternalController,
    updateSeopSettingsController,
    setSeopCertController,
};
