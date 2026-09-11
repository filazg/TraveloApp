// Provjera graditelja stringova za potpis prema primjerima iz specifikacije
// SEOP v3.0. Ne zove SEOP i ne treba certifikat — uspoređuje samo riječi koje
// potpisujemo s onima koje dokument navodi.
//
// Pokretanje: node scripts/provjeri_stringove.js
const {
    opkZkbRaw, opkSignRaw, ppkSignRaw, ppkZkbRaw,
    cvikanjeSignRaw, stornoSignRaw, ponistiCvikanjeSignRaw, isplovljenjeSignRaw,
} = require('../controllers/seop/seopStringBuilders');

let palo = 0;

const provjeri = (naziv, dobiveno, ocekivano) => {
    const ok = dobiveno === ocekivano;
    if (!ok) palo += 1;
    console.log(`${ok ? 'OK  ' : 'PALO'}  ${naziv}`);
    if (!ok) {
        console.log('      dobiveno : ' + dobiveno);
        console.log('      ocekivano: ' + ocekivano);
    }
};

// --- 5.3.1 ZKB za obicnu kartu -------------------------------------------
const opk = {
    oznPlovKarte: 'OBICNA01',
    oznLuke1: 'HR201',
    oznLuke2: 'HR205',
    brLinije: '431',
    datIzd: new Date(2018, 0, 27, 8, 8, 10),
    datPut: new Date(2018, 0, 27, 9, 10, 10),
    redovCijena: 10,
    namjena: 'V',
    visestruka: 0,
    masa: 999,
    oznPristupTocke: 'Tocka1',
    brodarevOIB: '23997850804',
};
provjeri(
    'ZKB obicne karte (5.3.1)',
    opkZkbRaw(opk),
    'OBICNA01HR201HR2054312018-01-27T08:08:102018-01-27T09:10:1010V0999Tocka123997850804'
);

// --- 5.4.1 potpis obicne karte -------------------------------------------
// Dokument u ovom primjeru ZKB pise VELIKIM slovima.
provjeri(
    'potpis obicne karte (5.4.1, ZKB velikim)',
    opkSignRaw({ ...opk, zkb: '509B406C76E2055FC375A726D396F59D' }),
    'OBICNA01HR201HR2054312018-01-27T08:08:102018-01-27T09:10:1010V509B406C76E2055FC375A726D396F59D0999Tocka123997850804'
);

// --- 5.5 potpis povlastene karte -----------------------------------------
// Isti dokument u primjeru uz metodu ZKB pise MALIM slovima, a u XML-u velikim.
const ppk = {
    oznOtIs: null,
    sBrOtIs: '1004135',
    regOzn: null,
    iks: null,
    oib: null,
    oznPlovKarte: 'OZNAKAKARTE',
    oznLuke1: 'HR201',
    oznLuke2: 'HR205',
    brLinije: '431',
    datIzd: new Date(2019, 0, 3, 5, 0, 0),
    datPut: new Date(2019, 0, 3, 7, 0, 0),
    redovCijena: 100,
    povlaCijena: 50,
    namjena: 'OOA',
    oznOdobrenja: 'Ima',
    uvijekProdaj: 0,
    zkb: 'db7c9b6f4545e9236062236c5a195720',
    visestruka: 0,
    oznPristupTocke: 'TOCKA01',
    brodarevOIB: '75039690265',
};
provjeri(
    'potpis povlastene karte (5.5, ZKB malim)',
    ppkSignRaw(ppk),
    '1004135OZNAKAKARTEHR201HR2054312019-01-03T05:00:002019-01-03T07:00:0010050OOAIma0db7c9b6f4545e9236062236c5a1957200TOCKA0175039690265'
);

// ZKB povlastene karte dokument NE navodi izrijekom. Radimo isti string bez
// samog ZKB-a; ovo je pretpostavka koju treba potvrditi na AKD-ovom testu.
console.log('\nZKB povlastene karte — dokument ne daje primjer, nas string:');
console.log('  ' + ppkZkbRaw(ppk));

// --- ostale metode --------------------------------------------------------
// Za njih dokument ne daje ispisane rijeci, nego samo popis parametara; ovo je
// provjera da se redoslijed i prazne vrijednosti ponasaju kako ocekujemo.
provjeri(
    'utrosak (ipk + vrijeme + plovidba + OIB)',
    cvikanjeSignRaw({ ipk: 'IPK1', vremTros: new Date(2026, 8, 11, 10, 0, 0), voyageID: 'V1', brodarevOIB: '123' }),
    'IPK12026-09-11T10:00:00V1123'
);
provjeri(
    'storno prodaje (bez vremena)',
    stornoSignRaw({ ipk: 'IPK1', brodarevOIB: '123' }),
    'IPK1123'
);
provjeri(
    'ponistenje utroska',
    ponistiCvikanjeSignRaw({ ipk: 'IPK1', brodarevOIB: '123' }),
    'IPK1123'
);
provjeri(
    'isplovljenje',
    isplovljenjeSignRaw({
        jop: 'JOP1', oznLukeIsplov: 'HR201', oznLukeUplov: 'HR205', brLinije: '431',
        vremIsplov: new Date(2026, 8, 11, 10, 0, 0), vremUplov: new Date(2026, 8, 11, 10, 50, 0),
        imo: '9999999', nib: 'NIB1', brodarevOIB: '123',
    }),
    'JOP1HR201HR2054312026-09-11T10:00:002026-09-11T10:50:009999999NIB1123'
);

console.log(palo ? `\n${palo} provjera nije prosla.` : '\nSve provjere su prosle.');
process.exitCode = palo ? 1 : 0;
