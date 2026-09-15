const fs = require('fs');
const path = require('path');

const { callSeop } = require('./soapClient');
const { loadP12, digSign, zkb, verifySeopSignature, fmtSeopDate } = require('./seopCrypto');
const { dohvatiPostavke, smijeSlati } = require('./seopSettings');
const {
    opkZkbRaw, opkSignRaw, ppkZkbRaw, ppkSignRaw,
    cvikanjeSignRaw, stornoSignRaw, ponistiCvikanjeSignRaw, isplovljenjeSignRaw,
} = require('./seopStringBuilders');

// Dojave prema SEOP-u. Jedno mjesto za sve četiri skupine poziva: prodaja
// (obična i povlaštena), utrošak i storno, poništenje utroška, isplovljenje.
//
// Pozivatelj (transactions servis) šalje naše podatke; ovdje se slaže zaštitni
// kod, potpis, SOAP i provjera potpisa odgovora.

const MAPA_CERT = path.join(__dirname, '..', '..', 'cert');

// Dokument si proturječi oko slova zaštitnog koda: u poglavlju 5.3 ZKB u
// potpisanoj riječi stoji VELIKIM slovima, a u primjeru uz metodu (5.5) malim —
// dok je u XML-u u oba slučaja velikim. Držimo se primjera uz metodu, jer je
// konkretniji, i ostavljamo jedno mjesto za promjenu kad AKD potvrdi na testu.
const zkbZaPotpis = (v) => String(v || '').toLowerCase();
const zkbZaXml = (v) => String(v || '').toUpperCase();

// XML escape — oznaka karte i luke dolaze iz naših podataka, ali se ne smije
// dogoditi da jedan znak sruši cijeli envelope.
const x = (v) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Prazan parametar SEOP traži kao xsi:nil, ne kao prazan element.
const nilOr = (naziv, v) => (v === null || v === undefined || v === ''
    ? `<seop:${naziv} xsi:nil="true"/>`
    : `<seop:${naziv}>${x(v)}</seop:${naziv}>`);

// Prazan (nil) element SEOP vraća kao objekt (`{ '@_nil': 'true' }`), a ne kao
// prazninu — pa je `String(m_Item)` davao „[object Object]". Ovo izvlači stvarnu
// vrijednost ili null (za nil ili prazan objekt).
const izVrijednosti = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object') {
        if (v['@_nil'] === 'true' || v['@_xsi:nil'] === 'true') return null;
        if ('#text' in v) return String(v['#text']).trim();
        return null;
    }
    return String(v).trim();
};

function kljuc(postavke) {
    const ime = postavke.p12_file || 'kapetan-luka.p12';
    const putanja = ime.includes('/') || ime.includes('\\')
        ? path.resolve(__dirname, '..', '..', ime)
        : path.join(MAPA_CERT, ime);
    return loadP12(putanja, postavke.p12_password || '').key;
}

// SEOP potpisuje svoje odgovore; brodar to provjerava javnim ključem AKD-a.
// Bez tog certifikata provjera se ne može napraviti — to nije greška dojave,
// nego podatak koji ide uz zapis, da se poslije zna je li odgovor bio provjeren.
function provjeriPotpisOdgovora(postavke, dijelovi, potpis) {
    if (!postavke.sign_cert_file || !potpis) return null;
    try {
        const putanja = path.join(MAPA_CERT, path.basename(postavke.sign_cert_file));
        const pem = fs.readFileSync(putanja, 'utf8');
        const rijec = dijelovi.filter((d) => d !== null && d !== undefined && d !== '').join('');
        return verifySeopSignature(rijec, potpis, pem);
    } catch (e) {
        console.log('[seop] potpis odgovora nije provjeren:', e?.message || e);
        return null;
    }
}

// Zajednička priprema: postavke, prekidači, OIB i lozinka.
async function pripremi(metoda, opcije = {}) {
    const postavke = await dohvatiPostavke();
    const dopusteno = smijeSlati(postavke, metoda, opcije);
    if (!dopusteno.smije) {
        return { postavke, preskoci: { ok: false, preskoceno: true, poruka: dopusteno.razlog } };
    }
    if (!postavke.brodarev_oib || !postavke.lozinka) {
        return { postavke, preskoci: { ok: false, preskoceno: true, poruka: 'OIB brodara ili lozinka nisu postavljeni' } };
    }
    return { postavke, preskoci: null };
}

// --- prodaja obične karte -------------------------------------------------

async function dojaviProdajuOPK(p) {
    const { postavke, preskoci } = await pripremi('DojaviProdajuOPKEur');
    if (preskoci) return preskoci;

    const osnova = {
        ...p,
        brodarevOIB: postavke.brodarev_oib,
        oznPristupTocke: p.oznPristupTocke || postavke.ozn_pristup_tocke_fixed || '',
    };
    const k = kljuc(postavke);
    const zastitniKod = zkb(opkZkbRaw(osnova), k);
    const potpis = digSign(opkSignRaw({ ...osnova, zkb: zkbZaPotpis(zastitniKod) }), k);

    const bodyXml = `<seop:DojaviProdajuOPKEur>
        <seop:oznPlovKarte>${x(osnova.oznPlovKarte)}</seop:oznPlovKarte>
        <seop:oznLuke1>${x(osnova.oznLuke1)}</seop:oznLuke1>
        <seop:oznLuke2>${x(osnova.oznLuke2)}</seop:oznLuke2>
        <seop:brLinije>${x(osnova.brLinije)}</seop:brLinije>
        <seop:datIzd>${fmtSeopDate(osnova.datIzd)}</seop:datIzd>
        <seop:datPut>${fmtSeopDate(osnova.datPut)}</seop:datPut>
        <seop:redovCijenaEur>${x(osnova.redovCijena)}</seop:redovCijenaEur>
        <seop:namjena>${x(osnova.namjena)}</seop:namjena>
        <seop:zkb>${zkbZaXml(zastitniKod)}</seop:zkb>
        <seop:visestruka>${osnova.visestruka ? 1 : 0}</seop:visestruka>
        ${nilOr('masa', osnova.masa)}
        <seop:oznPristupTocke>${x(osnova.oznPristupTocke)}</seop:oznPristupTocke>
        <seop:digSigProdaje>${potpis}</seop:digSigProdaje>
        <seop:brodarevOIB>${x(postavke.brodarev_oib)}</seop:brodarevOIB>
        <seop:lozinka>${x(postavke.lozinka)}</seop:lozinka>
      </seop:DojaviProdajuOPKEur>`;

    const odgovor = await callSeop({ method: 'DojaviProdajuOPKEur', bodyXml });
    return citajProdaju(odgovor, 'DojaviProdajuOPKEurResponse', 'DojaviProdajuOPKEurResult', postavke, zastitniKod);
}

// --- prodaja povlaštene karte ---------------------------------------------

async function dojaviProdajuPPK(p) {
    const { postavke, preskoci } = await pripremi('DojaviProdajuPPK_3Eur');
    if (preskoci) return preskoci;

    const osnova = {
        ...p,
        brodarevOIB: postavke.brodarev_oib,
        oznPristupTocke: p.oznPristupTocke || postavke.ozn_pristup_tocke_fixed || '',
    };
    const k = kljuc(postavke);
    const zastitniKod = zkb(ppkZkbRaw(osnova), k);
    const potpis = digSign(ppkSignRaw({ ...osnova, zkb: zkbZaPotpis(zastitniKod) }), k);

    const bodyXml = `<seop:DojaviProdajuPPK_3Eur>
        ${nilOr('oznOtIs', osnova.oznOtIs)}
        ${nilOr('sBrOtIs', osnova.sBrOtIs)}
        ${nilOr('regOzn', osnova.regOzn)}
        ${nilOr('iks', osnova.iks)}
        ${nilOr('oib', osnova.oib)}
        <seop:oznPlovKarte>${x(osnova.oznPlovKarte)}</seop:oznPlovKarte>
        <seop:oznLuke1>${x(osnova.oznLuke1)}</seop:oznLuke1>
        <seop:oznLuke2>${x(osnova.oznLuke2)}</seop:oznLuke2>
        <seop:brLinije>${x(osnova.brLinije)}</seop:brLinije>
        <seop:datIzd>${fmtSeopDate(osnova.datIzd)}</seop:datIzd>
        <seop:datPut>${fmtSeopDate(osnova.datPut)}</seop:datPut>
        <seop:redovCijenaEur>${x(osnova.redovCijena)}</seop:redovCijenaEur>
        <seop:povlaCijenaEur>${x(osnova.povlaCijena)}</seop:povlaCijenaEur>
        <seop:namjena>${x(osnova.namjena)}</seop:namjena>
        ${nilOr('oznOdobrenja', osnova.oznOdobrenja)}
        <seop:uvijekProdaj>${osnova.uvijekProdaj ? 1 : 0}</seop:uvijekProdaj>
        <seop:zkb>${zkbZaXml(zastitniKod)}</seop:zkb>
        <seop:visestruka>${osnova.visestruka ? 1 : 0}</seop:visestruka>
        <seop:oznPristupTocke>${x(osnova.oznPristupTocke)}</seop:oznPristupTocke>
        <seop:digSigProdaje>${potpis}</seop:digSigProdaje>
        <seop:brodarevOIB>${x(postavke.brodarev_oib)}</seop:brodarevOIB>
        <seop:lozinka>${x(postavke.lozinka)}</seop:lozinka>
      </seop:DojaviProdajuPPK_3Eur>`;

    const odgovor = await callSeop({ method: 'DojaviProdajuPPK_3Eur', bodyXml });
    return citajProdaju(odgovor, 'DojaviProdajuPPK_3EurResponse', 'DojaviProdajuPPK_3EurResult', postavke, zastitniKod);
}

// Prodaja vraća uređenu četvorku (OPK trojku): transakcija, IPK, je li karta
// pala na poništenu iskaznicu, potpis.
function citajProdaju(odgovor, imeOdgovora, imeRezultata, postavke, zastitniKod) {
    const r = odgovor.parsed?.Envelope?.Body?.[imeOdgovora]?.[imeRezultata];
    if (!r) {
        return {
            ok: false,
            // Poslovni razlog stoji u SeopGreska.Opis (fault.seop_opis); SOAP
            // `reason` je generički ("Baza podataka") i k tome objekt, pa se ne
            // smije vraćati sirov — inače blagajna vidi „[object Object]".
            poruka: odgovor.fault?.seop_opis || odgovor.fault?.reason?.['#text'] || odgovor.fault?.reason || 'neočekivan oblik odgovora',
            seop_kod: odgovor.fault?.seop_kod || null,
            http: odgovor.httpStatus,
        };
    }
    // OPK vraća par (transakcija, ipk) + potpis; PPK uz to i oznaku da je karta
    // evidentirana kao obična.
    const stavke = [r.m_Item1, r.m_Item2, r.m_Item3, r.m_Item4].map(izVrijednosti);
    const imaZastavicu = stavke[3] !== null;
    const transakcija = stavke[0];
    const ipk = stavke[1];
    const obicna = imaZastavicu ? (stavke[2] === 'true') : false;
    const potpis = imaZastavicu ? stavke[3] : stavke[2];

    return {
        ok: !!ipk,
        transakcija,
        ipk,
        kao_obicna: obicna,
        zkb: zastitniKod,
        potpis_ok: provjeriPotpisOdgovora(
            postavke,
            imaZastavicu ? [transakcija, ipk, String(obicna)] : [transakcija, ipk],
            potpis ? String(potpis).trim() : null
        ),
        http: odgovor.httpStatus,
    };
}

// --- utrošak i storno -----------------------------------------------------

// Ista metoda za oboje: utrošak nosi vrijeme, storno ga nema. Zato i dva
// različita stringa za potpis.
async function dojaviCvikanje({ ipk, vremTros = null, voyageID = null, povlastena = false }) {
    const metoda = vremTros ? 'DojaviCvikanje' : 'Storno';
    // Storno koristi svoj prekidač (`send_storno`); cvikanje se dijeli na
    // običnu/povlaštenu po `povlastena`.
    const { postavke, preskoci } = await pripremi(metoda, { povlastena });
    if (preskoci) return preskoci;

    const osnova = { ipk, vremTros, voyageID, brodarevOIB: postavke.brodarev_oib };
    const k = kljuc(postavke);
    const potpis = digSign(vremTros ? cvikanjeSignRaw(osnova) : stornoSignRaw(osnova), k);

    const bodyXml = `<seop:DojaviCvikanje>
        <seop:ipk>${x(ipk)}</seop:ipk>
        ${vremTros ? `<seop:vremTros>${fmtSeopDate(vremTros)}</seop:vremTros>` : '<seop:vremTros xsi:nil="true"/>'}
        ${nilOr('voyageID', voyageID)}
        <seop:digSigUtroska>${potpis}</seop:digSigUtroska>
        <seop:brodarevOIB>${x(postavke.brodarev_oib)}</seop:brodarevOIB>
        <seop:lozinka>${x(postavke.lozinka)}</seop:lozinka>
      </seop:DojaviCvikanje>`;

    const odgovor = await callSeop({ method: 'DojaviCvikanje', bodyXml });
    return citajTrojku(odgovor, 'DojaviCvikanjeResponse', 'DojaviCvikanjeResult', postavke);
}

async function ponistiCvikanje({ ipk, povlastena = false }) {
    const { postavke, preskoci } = await pripremi('PonistiCvikanjePojedinacna', { povlastena });
    if (preskoci) return preskoci;

    const k = kljuc(postavke);
    const potpis = digSign(ponistiCvikanjeSignRaw({ ipk, brodarevOIB: postavke.brodarev_oib }), k);

    const bodyXml = `<seop:PonistiCvikanjePojedinacna>
        <seop:ipk>${x(ipk)}</seop:ipk>
        <seop:digSigStornaUtroska>${potpis}</seop:digSigStornaUtroska>
        <seop:brodarevOIB>${x(postavke.brodarev_oib)}</seop:brodarevOIB>
        <seop:lozinka>${x(postavke.lozinka)}</seop:lozinka>
      </seop:PonistiCvikanjePojedinacna>`;

    const odgovor = await callSeop({ method: 'PonistiCvikanjePojedinacna', bodyXml });
    return citajTrojku(odgovor, 'PonistiCvikanjePojedinacnaResponse', 'PonistiCvikanjePojedinacnaResult', postavke);
}

// --- isplovljenje ---------------------------------------------------------

async function dojaviIsplovljenje(p) {
    const { postavke, preskoci } = await pripremi('DojaviIsplovljenje');
    if (preskoci) return preskoci;

    const osnova = { ...p, brodarevOIB: postavke.brodarev_oib };
    const k = kljuc(postavke);
    const potpis = digSign(isplovljenjeSignRaw(osnova), k);

    const bodyXml = `<seop:DojaviIsplovljenje>
        <seop:jop>${x(osnova.jop)}</seop:jop>
        <seop:oznLukeIsplov>${x(osnova.oznLukeIsplov)}</seop:oznLukeIsplov>
        <seop:oznLukeUplov>${x(osnova.oznLukeUplov)}</seop:oznLukeUplov>
        <seop:brLinije>${x(osnova.brLinije)}</seop:brLinije>
        <seop:vremIsplov>${fmtSeopDate(osnova.vremIsplov)}</seop:vremIsplov>
        <seop:vremUplov>${fmtSeopDate(osnova.vremUplov)}</seop:vremUplov>
        ${nilOr('imo', osnova.imo)}
        ${nilOr('nib', osnova.nib)}
        <seop:digSigDojave>${potpis}</seop:digSigDojave>
        <seop:brodarevOIB>${x(postavke.brodarev_oib)}</seop:brodarevOIB>
        <seop:lozinka>${x(postavke.lozinka)}</seop:lozinka>
      </seop:DojaviIsplovljenje>`;

    const odgovor = await callSeop({ method: 'DojaviIsplovljenje', bodyXml });
    return citajTrojku(odgovor, 'DojaviIsplovljenjeResponse', 'DojaviIsplovljenjeResult', postavke);
}

// Cvikanje, storno cvika i isplovljenje vraćaju uređenu trojku:
// transakcija (null ako nije prošlo), poruka o razlogu, potpis.
function citajTrojku(odgovor, imeOdgovora, imeRezultata, postavke) {
    const r = odgovor.parsed?.Envelope?.Body?.[imeOdgovora]?.[imeRezultata];
    if (!r) {
        return {
            ok: false,
            poruka: odgovor.fault?.seop_opis || odgovor.fault?.reason?.['#text'] || odgovor.fault?.reason || 'neočekivan oblik odgovora',
            seop_kod: odgovor.fault?.seop_kod || null,
            http: odgovor.httpStatus,
        };
    }
    const transakcija = izVrijednosti(r.m_Item1);
    const poruka = izVrijednosti(r.m_Item2);
    const potpis = izVrijednosti(r.m_Item3);

    return {
        // SEOP javlja neuspjeh praznom transakcijom i porukom o razlogu, ne
        // greškom — pa se ishod čita iz nje, ne iz HTTP statusa.
        ok: !!transakcija,
        transakcija,
        poruka,
        potpis_ok: provjeriPotpisOdgovora(postavke, [transakcija, poruka], potpis),
        http: odgovor.httpStatus,
    };
}

module.exports = {
    dojaviProdajuOPK,
    dojaviProdajuPPK,
    dojaviCvikanje,
    ponistiCvikanje,
    dojaviIsplovljenje,
};
