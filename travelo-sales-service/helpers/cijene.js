// Cijena prema partneru koji prodaje u svoje ime.
//
// Takvom partneru ne prodajemo kartu putnika nego uslugu njemu: koliko ce on
// naplatiti putniku ne znamo niti nas se tice. Zato mu komuniciramo svoju
// cijenu — bez PDV-a, ali s lucnom pristojbom u sebi, jer se pristojba
// prosljeduje luci u cijelosti i ne umanjuje se ni za sto.
//
// Iz prodajne cijene: pristojba je 6 % cijene, ostatak nosi PDV 25 %.
//   25,00 -> pristojba 1,50 + osnovica 18,80 + PDV 4,70
//   cijena prema partneru = 1,50 + 18,80 = 20,30
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

module.exports = { HARBOR_RATE, VAT_RATE, bezPdv, zaSvojRacun };
