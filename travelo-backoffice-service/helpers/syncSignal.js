const axios = require("axios");
const { getCoreServiceConfigData } = require("../controllers/configSyncController");

// Javi uredajima da povuku osnovne podatke.
//
// Blagajna i mobilna sifarnike povlace same, a kanal prema terminalima slozeni
// sifarnik drzi u memoriji minutu. Novi operater ili drukciji postotak storna
// zato dotad uopce nisu mogli doci do uredaja, koliko god puta blagajnik
// pritisnuo osvjezavanje. Signal se biljezi u transakcijama, odakle ga kanal
// cita svakih par sekundi i memoriju brise odmah.
//
// Namjerno ne rusi radnju koja ga je pozvala: izmjena je vec spremljena, a
// uredaj ce je pokupiti najkasnije kad memorija istekne.
const javiPromjenu = async (kind, event) => {
    try {
        const coreConfig = await getCoreServiceConfigData();
        const txUrl = coreConfig?.services?.transactions?.url;
        if (!txUrl) return;
        await axios.post(`${txUrl}/sync_signals`, { kind, event }, { timeout: 8000, validateStatus: () => true });
    } catch (error) {
        console.log("javiPromjenu nije uspio:", error?.message || error);
    }
};

// Middleware za rute koje mijenjaju osnovne podatke uredaja. Signal ide tek kad
// je odgovor otisao — cekanje na signal prije odgovora usporilo bi portal bez
// potrebe.
//
// HTTP status je gruba mjera: dio kontrolera ovdje i odbijenicu salje kao 200 s
// porukom u tijelu, pa poneki signal ode i kad izmjena nije prosla. Cijena je
// jedno dohvacanje sifarnika viska, dok bi citanje tudeg tijela odgovora ovdje
// bilo krhko.
const javiIzmjenuOsnovnihPodataka = (req, res, next) => {
    if (req.method === "GET") return next();
    res.on("finish", () => {
        if (res.statusCode >= 400) return;
        javiPromjenu("basic", `${req.method} ${req.baseUrl || ""}${req.path}`);
    });
    next();
};

module.exports = { javiPromjenu, javiIzmjenuOsnovnihPodataka };
