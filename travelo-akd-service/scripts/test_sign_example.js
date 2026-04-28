// Deterministic test našeg ZKB + digSig helpera na primjeru iz spec v3.0.
// Prima p12 + lozinku preko env-a, da se ne hardkodira. Runtime ne treba
// ni control-service ni bazu — radi čist crypto unit test protiv spec primjera.
//
// Primjer iz spec-a (DojaviProdajuOPKKn/Eur) — "puna riječ" koju brodar potpisuje:
//   OBICNA01HR201HR2054312018-01-27T08:08:102018-01-27T09:10:1010V a1e6b1428f0cc755f0c82aa7a1327002999Tocka123997850804
//
// NAPOMENA: spec primjer koristi brodarev OIB 23997850804 i njegov ZKB/digSig
// vezane su za TAJ p12. S našim p12 (Kapetan Luka, CN=kapetan-luka.seop.akd.hr)
// dobijemo DRUGE izlaze — ovo je ok; bitno je samo da kod deterministički radi i
// da naš potpis prolazi SEOP-ovu verifikaciju (što testiramo kasnije kroz live poziv).

const path = require('path');
const { loadP12, digSign, zkb } = require('../controllers/seop/seopCrypto');
const { opkZkbRaw, opkSignRaw } = require('../controllers/seop/seopStringBuilders');

const P12_PATH = process.env.AKD_P12_PATH || path.join(__dirname, '..', 'cert', 'kapetan-luka.p12');
const P12_PASS = process.env.AKD_P12_PASS || '123456';

function main() {
    const { key, cert } = loadP12(P12_PATH, P12_PASS);
    console.log('Cert Subject:', cert.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(', '));
    console.log('Cert Valid :', cert.validity.notBefore.toISOString(), '→', cert.validity.notAfter.toISOString());
    console.log('');

    // Spec DojaviProdajuOPK* primjer (sintetički — koristimo kao sanity check formata).
    const params = {
        oznPlovKarte: 'OBICNA01',
        oznLuke1: 'HR201',
        oznLuke2: 'HR205',
        brLinije: '431',
        datIzd: '2018-01-27T08:08:10',
        datPut: '2018-01-27T09:10:10',
        redovCijena: 10,
        namjena: 'V',
        visestruka: 0,
        masa: 999,
        oznPristupTocke: 'Tocka1',
        brodarevOIB: '23997850804',
    };

    const zkbRaw = opkZkbRaw(params);
    console.log('ZKB raw string:');
    console.log(zkbRaw);
    console.log('Expected (spec):');
    console.log('OBICNA01HR201HR2054312018-01-27T08:08:102018-01-27T09:10:1010V0999Tocka123997850804');
    console.log('MATCH:', zkbRaw === 'OBICNA01HR201HR2054312018-01-27T08:08:102018-01-27T09:10:1010V0999Tocka123997850804');
    console.log('');

    const zkbHex = zkb(zkbRaw, key);
    console.log('ZKB (naš potpis, MD5 RSA-SHA256):', zkbHex);

    const signRaw = opkSignRaw({ ...params, zkb: zkbHex });
    const sig = digSign(signRaw, key);
    console.log('');
    console.log('digSig raw string:');
    console.log(signRaw);
    console.log('digSig Base64 (prvih 80):', sig.slice(0, 80), '…');
}

main();
