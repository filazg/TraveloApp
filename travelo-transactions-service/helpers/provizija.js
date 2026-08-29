// Osnovica za proviziju.
//
// Provizija se NIKAD ne racuna na naplaceni iznos: u cijeni karte sjede lucka
// pristojba, koja je prolazna stavka i nije nas prihod, i PDV, koji je drzavin.
// Osnovica je ono sto ostane — bruto bez pristojbe i bez PDV-a — i po njoj se
// racuna i partnerov obracun i racun koji mu izdajemo, da izvjestaj i racun
// nikad ne pokazu razlicit iznos.
const HARBOR_RATE = 0.06;
const VAT_RATE = 0.25;

const neto = (iznos) => {
    const bruto = Number(iznos) || 0;
    const pristojba = +(bruto * HARBOR_RATE).toFixed(2);
    const bezPristojbe = bruto - pristojba;
    const osnovica = +(bezPristojbe / (1 + VAT_RATE)).toFixed(2);
    return { bruto, pristojba, osnovica, pdv: +(bezPristojbe - osnovica).toFixed(2) };
};

// Provizija se racuna na zbroj osnovice, a ne po karti — zaokruzivanje po karti
// bi na vecem broju karata odstupilo od iznosa koji se stvarno placa.
const provizijaOd = (osnovica, postotak) =>
    +((Number(osnovica) || 0) * (Number(postotak) || 0) / 100).toFixed(2);

// Partner koji prodaje u svoje ime dobiva nasu cijenu bez PDV-a (s luckom
// pristojbom u sebi) i po njoj naruc uje. Karta i dalje nosi prodajnu cijenu s
// PDV-om, jer se po njoj obracunava provizija i izdaje racun, pa se primljeni
// iznos vraca natrag na prodajnu cijenu.
//   20,30 -> 25,00
const FAKTOR_BEZ_PDV = HARBOR_RATE + (1 - HARBOR_RATE) / (1 + VAT_RATE);
const izCijeneBezPdv = (cijenaBezPdv) =>
    +((Number(cijenaBezPdv) || 0) / FAKTOR_BEZ_PDV).toFixed(2);

module.exports = { HARBOR_RATE, VAT_RATE, neto, provizijaOd, izCijeneBezPdv };
