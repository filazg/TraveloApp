const axios = require("axios");
const { getCoreServiceConfigData } = require("../controllers/configSyncController");

// Javi uredajima da povuku podatke.
//
// Blagajna i mobilna rade offline i vozni red povlace same, pa otkazan ili
// pomaknut polazak ne vide dok korisnik sam ne pokrene osvjezavanje — do tada ga
// i dalje prodaju. Signal se biljezi u transakcijama, odakle ga uredaji citaju
// jednim laganim upitom.
//
// Namjerno ne ruši radnju koja ga je pozvala: polazak je vec otkazan, a uredaj
// ce promjenu pokupiti i pri redovnom osvjezavanju.
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

module.exports = { javiPromjenu };
