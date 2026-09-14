// Katalog prava na povlašteni prijevoz, poglavlje 3. specifikacije SEOP v3.0.
//
// Trebamo ga zbog jedne odluke: linija se u portalu može postaviti na
// „samo otočani s prebivalištem". SEOP na to pitanje ne odgovara izravno — vraća
// šifru prava, a iz Pravilnika se vidi je li ta kategorija vezana uz prebivalište
// na otoku ili uz nešto drugo (mjesto rada, dob, javna služba).
//
// Zadnje slovo šifre je razred prava: P = popust, B = besplatno, K = kombinirano.
const KATALOG = {
    "01P":  { rezident: true,  opis: "Djeca 3–12 s prebivalištem na otoku" },
    "02P":  { rezident: true,  opis: "Osobe s prebivalištem na otoku (redovni korisnici)" },
    "03K":  { rezident: true,  opis: "Učenici s otoka koji putuju do škole" },
    "03Ka": { rezident: true,  opis: "Učenici koji pohađaju školu na otoku prebivališta" },
    "03Kb": { rezident: true,  opis: "Predškolci na otoku prebivališta" },
    "03Kc": { rezident: true,  opis: "Predškolci izvan otoka prebivališta" },
    "04K":  { rezident: true,  opis: "Studenti s otoka koji putuju do visokoškolske ustanove" },
    "04Ka": { rezident: true,  opis: "Studenti na otoku prebivališta" },
    "05K":  { rezident: true,  opis: "Učenici koji zbog školovanja privremeno borave izvan otoka" },
    "06K":  { rezident: true,  opis: "Studenti koji zbog studija privremeno borave izvan otoka" },
    "07B":  { rezident: true,  opis: "Umirovljenici s otoka druge skupine" },
    "08B":  { rezident: true,  opis: "Osobe starije od 65 s otoka druge skupine" },
    "09B":  { rezident: true,  opis: "Umirovljenici s otoka prve skupine" },
    "10B":  { rezident: true,  opis: "Osobe starije od 65 s otoka prve skupine" },
    "11P":  { rezident: false, opis: "Djeca 3–12 bez prebivališta na otoku (virtualna iskaznica)" },
    "12P":  { rezident: true,  opis: "Vozilo otočana, trajektne linije" },
    "13P":  { rezident: true,  opis: "Vozilo pravne osobe sa sjedištem na otoku" },
    "14B":  { rezident: false, opis: "Javne službe u katastrofama i spašavanju" },
    "15B":  { rezident: false, opis: "Vozila javnih službi u katastrofama i spašavanju" },
    "16B":  { rezident: false, opis: "Sva djeca 1–3 godine" },
    "17P":  { rezident: false, opis: "Djelatnici javnih službi s mjestom rada na otoku" },
    "18P":  { rezident: false, opis: "Službena vozila javnih službi na otoku" },
    "19P":  { rezident: false, opis: "Zdravstveni djelatnici pri prijevozu bolesnika" },
    "20P":  { rezident: false, opis: "Službena vozila zdravstvenih službi" },
    "21B":  { rezident: false, opis: "Djelatnici javnih zdravstvenih službi i policije" },
    "22B":  { rezident: false, opis: "Službena vozila zdravstvenih službi i policije" },
    "23P":  { rezident: false, opis: "Javne službe 17P/19P na virtualnoj iskaznici" },
    "24P":  { rezident: false, opis: "Vozila javnih službi 18P/20P na virtualnoj iskaznici" },
    "25P":  { rezident: true,  opis: "Bicikli otočana" },
    "26B":  { rezident: false, opis: "Vozila osoba s invaliditetom" },
};

// Katalog se po Pravilniku mijenja, a specifikacija izrijekom kaže da se zbog
// toga brodareva aplikacija ne mora mijenjati. Nepoznata šifra zato ne smije
// srušiti prodaju: tretira se kao nevezana uz prebivalište, jer je to uže
// tumačenje i ne dodjeljuje povlasticu koju linija nije prihvatila.
const pravoJeRezidentsko = (sifra) => {
    const zapis = KATALOG[String(sifra || "").trim()];
    return zapis ? zapis.rezident : false;
};

const opisPrava = (sifra) => KATALOG[String(sifra || "").trim()]?.opis || null;

const razredPrava = (sifra) => {
    const s = String(sifra || "").trim();
    if (!s) return null;
    if (s.endsWith("B")) return "besplatno";
    if (s.endsWith("K")) return "kombinirano";
    if (s.endsWith("P")) return "popust";
    // 03Ka, 04Ka i slični nose razred na poziciji prije malog slova.
    const veliko = s.replace(/[a-z]+$/, "").slice(-1);
    if (veliko === "B") return "besplatno";
    if (veliko === "K") return "kombinirano";
    if (veliko === "P") return "popust";
    return null;
};

module.exports = { KATALOG, pravoJeRezidentsko, opisPrava, razredPrava };
