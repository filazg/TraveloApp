const axios = require("axios");
const { getCoreServiceConfigData } = require("../controllers/configSyncController");

// Cijena prema partneru koji prodaje u svoje ime.
//
// Takvom partneru ne prodajemo kartu putnika nego uslugu njemu: koliko ce on
// naplatiti putniku ne znamo niti nas se tice. Zato mu mozemo komunicirati
// svoju cijenu — bez PDV-a, ali s luckom pristojbom u sebi, jer se pristojba
// prosljeduje luci u cijelosti i ne umanjuje se ni za sto.
//
// Iz prodajne cijene: pristojba je 6 % cijene, ostatak nosi PDV 25 %.
//   25,00 -> pristojba 1,50 + osnovica 18,80 + PDV 4,70
//   cijena prema partneru = 1,50 + 18,80 = 20,30
//
// Nije za svakoga isto: bira se zastavicom na partneru, jer vec integriranim
// partnerima cijene ne smiju otici drugacije bez dogovora.
const HARBOR_RATE = 0.06;
const VAT_RATE = 0.25;

const bezPdv = (prodajnaCijena) => {
    const bruto = Number(prodajnaCijena) || 0;
    const pristojba = +(bruto * HARBOR_RATE).toFixed(2);
    const osnovica = +((bruto - pristojba) / (1 + VAT_RATE)).toFixed(2);
    return +(pristojba + osnovica).toFixed(2);
};

// Kanali u kojima partner prodaje za svoj racun. Prodaja u nase ime (partnersko
// prodajno mjesto s nasom blagajnom) ide po prodajnoj cijeni, kao i svaka nasa.
const zaSvojRacun = (kanal) => String(kanal || "") === "partner_web";

// Partneri se citaju iz backofficea i drze kratko u memoriji: cjenik se trazi
// pri svakom otvaranju prodaje, a zastavica se mijenja jednom u zivotu.
const MEMORIJA_MS = 60 * 1000;
let partneri = null;
let osvjezeno = 0;

const dohvatiPartnere = async () => {
    if (partneri && Date.now() - osvjezeno < MEMORIJA_MS) return partneri;
    try {
        const coreConfig = await getCoreServiceConfigData();
        const boUrl = coreConfig?.services?.backoffice?.url;
        if (!boUrl) return partneri || [];
        const resp = await axios.get(`${boUrl}/partners`, { timeout: 10000 });
        partneri = resp.data?.data?.partners || [];
        osvjezeno = Date.now();
        return partneri;
    } catch (error) {
        console.log("dohvatiPartnere error:", error?.message || error);
        return partneri || [];
    }
};

// Salje li se ovom partneru cijena bez PDV-a. Bez zastavice — i kad partnera ne
// nademo — ostaje po starom, s PDV-om: radije neka cijena ostane ista nego da
// se partneru tiho promijeni bez dogovora.
const saljeBezPdva = async (kanal, partnerUuid) => {
    if (!zaSvojRacun(kanal) || !partnerUuid) return false;
    const popis = await dohvatiPartnere();
    const partner = popis.find((p) => p.uuid === partnerUuid);
    return partner ? partner.prices_with_vat === false : false;
};

module.exports = { HARBOR_RATE, VAT_RATE, bezPdv, zaSvojRacun, saljeBezPdva };
