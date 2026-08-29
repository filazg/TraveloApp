const axios = require("axios");
const { getMainServiceConfigData } = require("../controllers/configSyncController");

// Tko je prijavljen u partnerskoj prodaji.
//
// Partner_uuid se NE uzima iz upita: klijent bi mogao poslati tudi i vidjeti
// tudi promet. Sesija se provjerava kod auth-servisa, koji jedini drzi kljuc
// kolacica, pa partner_uuid dolazi iz provjerene prijave. Gateway prosljeduje
// kolacic prema jezgri, pa je ovdje dostupan.
const provjeriPartnersku = async (req, res, next) => {
    try {
        const kolacic = req.headers.cookie || "";
        if (!kolacic.includes("travelo_partner_session")) {
            return res.status(401).json({ status: 401, data: { message: "Nema partnerske prijave" } });
        }
        const glavni = getMainServiceConfigData();
        const authUrl = glavni?.services?.auth?.url;
        if (!authUrl) {
            return res.status(500).json({ status: 500, data: { message: "auth servis nije dostupan" } });
        }
        const resp = await axios.get(`${authUrl}/login/partnerMe`, {
            headers: { cookie: kolacic },
            timeout: 10000,
            validateStatus: () => true,
        });
        const korisnik = resp.data?.data;
        if (resp.status !== 200 || !korisnik?.partner_uuid) {
            return res.status(401).json({ status: 401, data: { message: "Prijava je istekla" } });
        }
        req.partner = {
            partner_uuid: korisnik.partner_uuid,
            partner_name: korisnik.partner_name,
            username: korisnik.username,
            roles: String(korisnik.roles || "SALES").split(",").map((r) => r.trim()).filter(Boolean),
        };
        return next();
    } catch (error) {
        console.log("provjeriPartnersku error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { message: "Provjera prijave nije uspjela" } });
    }
};

// Financije su zasebna uloga: prodavac ne treba vidjeti obracun i racune.
const traziUlogu = (uloga) => (req, res, next) => {
    if (!req.partner?.roles?.includes(uloga)) {
        return res.status(403).json({ status: 403, data: { message: "Nemate pristup ovom dijelu" } });
    }
    return next();
};

module.exports = { provjeriPartnersku, traziUlogu };
