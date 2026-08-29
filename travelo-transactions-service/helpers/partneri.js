const axios = require("axios");
const { getCoreServiceConfigData } = require("../controllers/configSyncController");

// Partneri iz backofficea, s kratkom memorijom: citaju se pri svakoj prodaji, a
// mijenjaju se jednom u zivotu.
const MEMORIJA_MS = 60 * 1000;
let popis = null;
let osvjezeno = 0;

const dohvatiPartnere = async () => {
    if (popis && Date.now() - osvjezeno < MEMORIJA_MS) return popis;
    try {
        const coreConfig = await getCoreServiceConfigData();
        const boUrl = coreConfig?.services?.backoffice?.url;
        if (!boUrl) return popis || [];
        const resp = await axios.get(`${boUrl}/partners`, { timeout: 10000 });
        popis = resp.data?.data?.partners || [];
        osvjezeno = Date.now();
        return popis;
    } catch (error) {
        console.log("dohvatiPartnere error:", error?.message || error);
        return popis || [];
    }
};

// Salje li se ovom partneru cijena bez PDV-a kad prodaje za svoj racun. Bez
// zastavice — i kad partnera ne nademo — ostaje po starom, s PDV-om.
const saljeBezPdva = async (partnerUuid) => {
    if (!partnerUuid) return false;
    const partneri = await dohvatiPartnere();
    const partner = partneri.find((p) => p.uuid === partnerUuid);
    return partner ? partner.prices_with_vat === false : false;
};

module.exports = { dohvatiPartnere, saljeBezPdva };
