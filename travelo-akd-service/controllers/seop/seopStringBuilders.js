const { fmtSeopDate } = require('./seopCrypto');

// Redoslijed iz SEOP spec v3.0 (2022-11-07 verzija).
// VAŽNO: bool vrijednosti → "0" / "1", null/undefined → "". Decimalne cijene
// idu bez grupatora i bez decimalne točke kad je cijeli broj (spec-ov primjer:
// "10" za 10 kn/eur). Čuvamo točnu ASCII reprezentaciju koju brodar šalje u XML.

const asBool = (v) => (v === true || v === 'true' || v === 1 || v === '1') ? '1' : '0';
const asNum  = (v) => (v === null || v === undefined || v === '') ? '' : String(v);
const asStr  = (v) => (v === null || v === undefined) ? '' : String(v);

// ZKB raw string (za DojaviProdajuOPK*): bez zkb parametra, bez digSig, bez brodarevOIB-a NA KRAJU
// Čekaj — spec ima brodarevOIB NA KRAJU i za ZKB raw string:
// "(oznPlovKarte + oznLuke1 + oznLuke2 + brLinije + datIzd + datPut + redovCijena +
//  namjena + visestruka + masa + oznPristupTocke + brodarevOIB)"
function opkZkbRaw(p) {
    return [
        asStr(p.oznPlovKarte),
        asStr(p.oznLuke1),
        asStr(p.oznLuke2),
        asStr(p.brLinije),
        fmtSeopDate(p.datIzd),
        fmtSeopDate(p.datPut),
        asNum(p.redovCijena),
        asStr(p.namjena),
        asBool(p.visestruka),
        asNum(p.masa),
        asStr(p.oznPristupTocke),
        asStr(p.brodarevOIB),
    ].join('');
}

// digSig raw string za DojaviProdajuOPKEur / DojaviProdajuOPKKn:
// parametri koji se potpisuju = {oznPlovKarte, oznLuke1, oznLuke2, brLinije, datIzd,
// datPut, redovCijena(Eur), namjena, zkb, visestruka, masa, oznPristupTocke, brodarevOIB}
function opkSignRaw(p) {
    return [
        asStr(p.oznPlovKarte),
        asStr(p.oznLuke1),
        asStr(p.oznLuke2),
        asStr(p.brLinije),
        fmtSeopDate(p.datIzd),
        fmtSeopDate(p.datPut),
        asNum(p.redovCijena),
        asStr(p.namjena),
        asStr(p.zkb),
        asBool(p.visestruka),
        asNum(p.masa),
        asStr(p.oznPristupTocke),
        asStr(p.brodarevOIB),
    ].join('');
}

// ZKB raw za povlaštene (PPK_3*): isti parametri kao OPK + oznOdobrenja + povlaCijena*?
// Spec daje SAMO za OPK eksplicitan raw — za PPK_3 potpis parametri su navedeni,
// ali ZKB formula u spec. kaže: ZKB se radi od istih osnovnih polja. Iz primjera u spec-u
// za DojaviProdajuPPK_3Kn "puna riječ" glasi:
//   1004135OZNAKAKARTEHR201HR2054312019-01-03T05:00:002019-01-03T07:00:0010050OOAIma0db7c9b6f4545e9236062236c5a1957200TOCKA0175039690265
// što je sBrOtIs + oznPlovKarte + oznLuke1 + oznLuke2 + brLinije + datIzd + datPut +
//   redovCijena + povlaCijena + namjena + oznOdobrenja + uvijekProdaj + zkb +
//   visestruka + oznPristupTocke + brodarevOIB
// (nema "masa" u PPK_3 — vozila/mase se ne mjeri unutra).
function ppkSignRaw(p) {
    return [
        // identifikatori (jedan od njih)
        asStr(p.oznOtIs),
        asStr(p.sBrOtIs),
        asStr(p.regOzn),
        asStr(p.iks),
        asStr(p.oib),
        asStr(p.oznPlovKarte),
        asStr(p.oznLuke1),
        asStr(p.oznLuke2),
        asStr(p.brLinije),
        fmtSeopDate(p.datIzd),
        fmtSeopDate(p.datPut),
        asNum(p.redovCijena),
        asNum(p.povlaCijena),
        asStr(p.namjena),
        asStr(p.oznOdobrenja),
        asBool(p.uvijekProdaj),
        asStr(p.zkb),
        asBool(p.visestruka),
        asStr(p.oznPristupTocke),
        asStr(p.brodarevOIB),
    ].join('');
}

// Za ZKB PPK isti string, samo BEZ zkb polja (jer ga upravo generiramo).
function ppkZkbRaw(p) {
    return [
        asStr(p.oznOtIs),
        asStr(p.sBrOtIs),
        asStr(p.regOzn),
        asStr(p.iks),
        asStr(p.oib),
        asStr(p.oznPlovKarte),
        asStr(p.oznLuke1),
        asStr(p.oznLuke2),
        asStr(p.brLinije),
        fmtSeopDate(p.datIzd),
        fmtSeopDate(p.datPut),
        asNum(p.redovCijena),
        asNum(p.povlaCijena),
        asStr(p.namjena),
        asStr(p.oznOdobrenja),
        asBool(p.uvijekProdaj),
        asBool(p.visestruka),
        asStr(p.oznPristupTocke),
        asStr(p.brodarevOIB),
    ].join('');
}

// DojaviCvikanje — potpisuju se: {ipk, vremTros, voyageID, brodarevOIB}.
function cvikanjeSignRaw(p) {
    return [
        asStr(p.ipk),
        p.vremTros ? fmtSeopDate(p.vremTros) : '',
        asStr(p.voyageID),
        asStr(p.brodarevOIB),
    ].join('');
}

// Storno prodaje (via DojaviCvikanje): {ipk, brodarevOIB}.
function stornoSignRaw(p) {
    return [asStr(p.ipk), asStr(p.brodarevOIB)].join('');
}

// PonistiCvikanjePojedinacna: {ipk, brodarevOIB}.
function ponistiCvikanjeSignRaw(p) {
    return [asStr(p.ipk), asStr(p.brodarevOIB)].join('');
}

// DojaviIsplovljenje: {jop, oznLukeIsplov, oznLukeUplov, brLinije, vremIsplov, vremUplov, imo, nib, brodarevOIB}.
function isplovljenjeSignRaw(p) {
    return [
        asStr(p.jop),
        asStr(p.oznLukeIsplov),
        asStr(p.oznLukeUplov),
        asStr(p.brLinije),
        fmtSeopDate(p.vremIsplov),
        fmtSeopDate(p.vremUplov),
        asStr(p.imo),
        asStr(p.nib),
        asStr(p.brodarevOIB),
    ].join('');
}

module.exports = {
    opkZkbRaw,
    opkSignRaw,
    ppkZkbRaw,
    ppkSignRaw,
    cvikanjeSignRaw,
    stornoSignRaw,
    ponistiCvikanjeSignRaw,
    isplovljenjeSignRaw,
};
