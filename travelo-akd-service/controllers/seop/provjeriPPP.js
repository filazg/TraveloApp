const { callSeop } = require('./soapClient');
const { fmtSeopDate } = require('./seopCrypto');
const { getIntegrationsConfigData } = require('../configSyncController');

// Mock odgovori dok ne dobijemo svježi p12. Brojevi iz AKD demo seta:
//   5xxxxxx — redovni otočanin (02P, 50% popust)
//   6xxxxxx — javna služba ili specijalno pravo (TR5KM, 100% popust)
//   7xxxxxx — vozilo (12P, 50%)
//   ostali — "nema prava".
function mockProvjeriPPP({ sBrOtIs, oznOtIs }) {
    const id = sBrOtIs ? String(sBrOtIs).trim() : (oznOtIs || '').trim();
    const seven = /^[0-9]{7}$/.test(id) ? id : null;
    const lead = seven ? seven[0] : null;

    if (lead === '5') {
        return {
            ok: true,
            ima_pravo: true,
            broj_osn_iskoristen: 0,
            broj_dod_iskoristen: 0,
            otok: 'Brač',
            pravo_na_pp: '02P',
            poruka: 'Korisnik ima pravo na dodatni/kumulativni povlašteni prijevoz (popust) između traženih luka. (SXVC3)',
            kategorija_popusta: 'SXVC3',
            popust_postotak: 50,
            mock: true,
        };
    }
    if (lead === '6') {
        return {
            ok: true,
            ima_pravo: true,
            broj_osn_iskoristen: 0,
            broj_dod_iskoristen: 0,
            otok: 'Svi otoci',
            pravo_na_pp: '21B',
            poruka: 'DJELATNICI JAVNIH ZDRAVSTVENIH SLUŽBI / POLICIJE imaju pravo na besplatni prijevoz. (TR5KM)',
            kategorija_popusta: 'TR5KM',
            popust_postotak: 100,
            mock: true,
        };
    }
    if (lead === '7') {
        return {
            ok: true,
            ima_pravo: true,
            broj_osn_iskoristen: 0,
            broj_dod_iskoristen: 0,
            otok: 'Hvar',
            pravo_na_pp: '12P',
            poruka: 'Korisnik (vozilo) ima pravo na osnovni povlašteni prijevoz (popust). (SXVC3)',
            kategorija_popusta: 'SXVC3',
            popust_postotak: 50,
            mock: true,
        };
    }
    if (id === '6999993' || id === '1004135') {
        return {
            ok: true,
            ima_pravo: true,
            broj_osn_iskoristen: 0,
            broj_dod_iskoristen: 0,
            otok: null,
            pravo_na_pp: '16B',
            poruka: 'Korisnici virtualne iskaznice imaju neograničena prava na PP. (TR5KM)',
            kategorija_popusta: 'TR5KM',
            popust_postotak: 100,
            mock: true,
        };
    }
    return {
        ok: true,
        ima_pravo: false,
        broj_osn_iskoristen: 0,
        broj_dod_iskoristen: 0,
        otok: null,
        pravo_na_pp: null,
        poruka: `Korisnik otočne iskaznice uopće nema pravo na povlašteni prijevoz. Iskaznica ${id} nije pronađena. (MXRF1)`,
        kategorija_popusta: 'MXRF1',
        popust_postotak: 0,
        mock: true,
    };
}

// Sigurno escapeaj u XML.
const x = (v) => {
    if (v === null || v === undefined || v === '') return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

// `nilOr(tag, val)` — ako je vrijednost prazna, šalje xsi:nil="true", inače value.
const nilOr = (tag, v) => {
    if (v === null || v === undefined || v === '') return `<seop:${tag} xsi:nil="true"/>`;
    return `<seop:${tag}>${x(v)}</seop:${tag}>`;
};

// ProvjeriPPP — provjera prava na povlašteni prijevoz.
// Identifikacija putnika: jedno od (oznOtIs, sBrOtIs, regOzn, iks, oib).
// Ostali parametri obavezni: oznLuke1, oznLuke2, brLinije, datPut.
async function provjeriPPP({
    oznOtIs = null,     // UID čipa (string hex)
    sBrOtIs = null,     // serijski broj iskaznice (int)
    regOzn  = null,     // registarska oznaka (rezerva, max 30 dana)
    iks     = null,     // serijski broj iksice
    oib     = null,     // OIB korisnika (rezerva, max 30 dana)
    oznLuke1,
    oznLuke2,
    brLinije,
    datPut,
}) {
    if (!oznLuke1 || !oznLuke2 || !brLinije || !datPut) {
        throw new Error('ProvjeriPPP: nedostaje oznLuke1/oznLuke2/brLinije/datPut');
    }
    if (!oznOtIs && !sBrOtIs && !regOzn && !iks && !oib) {
        throw new Error('ProvjeriPPP: barem jedan identifikator (oznOtIs, sBrOtIs, regOzn, iks, oib) je obavezan');
    }

    // Mock režim — dok je p12 cert istekao, vraćamo sintetičke odgovore radi
    // razvoja frontend flow-a. Uključuje se postavljanjem akd.seop.environment="mock".
    const cfg = getIntegrationsConfigData()?.akd?.seop || {};
    if (cfg.environment === 'mock') {
        return mockProvjeriPPP({ sBrOtIs, oznOtIs });
    }

    const bodyXml = `<seop:ProvjeriPPP>
        ${nilOr('oznOtIs', oznOtIs)}
        ${nilOr('sBrOtIs', sBrOtIs)}
        <seop:oznLuke1>${x(oznLuke1)}</seop:oznLuke1>
        <seop:oznLuke2>${x(oznLuke2)}</seop:oznLuke2>
        <seop:BrLinije>${x(brLinije)}</seop:BrLinije>
        <seop:datPut>${fmtSeopDate(datPut)}</seop:datPut>
      </seop:ProvjeriPPP>`;

    const resp = await callSeop({ method: 'ProvjeriPPP', bodyXml });
    return interpretResponse(resp);
}

// SEOP vraća Tuple<bool, int, int, string, string, string> u DataContract
// shape-u: m_Item1..m_Item6. Iz spec-a (StanjePPP):
//  Item1: ImaPravoNaPP (bool)        — ima pravo i nije potrošeno
//  Item2: BrojOsn (int)              — iskorišteno OSNOVNO pravo
//  Item3: BrojDod (int)              — iskorišteno DODATNO pravo
//  Item4: Otok (string)              — naziv domicilnog otoka
//  Item5: PravoNaPP (string)         — šifra prava (npr. "02P")
//  Item6: Poruka (string)            — slobodna poruka, sufiks TR5KM/SXVC3/MXRF1
// (IznosPopusta, MaxOsn, MaxDod su navedeni u dokumentaciji ali ne pojavljuju se
// kao tuple komponente — vjerojatno drugi response format za SEOP v2.0+.)
function interpretResponse(resp) {
    const r = resp.parsed?.Envelope?.Body?.ProvjeriPPPResponse?.ProvjeriPPPResult;
    if (!r) {
        return { ok: false, raw: resp, error: resp.fault?.reason || 'unexpected response shape' };
    }
    const popusti = ['TR5KM', 'SXVC3', 'MXRF1'];
    const poruka = String(r.m_Item6 || '');
    let kategorija = null;
    for (const p of popusti) if (poruka.endsWith(p)) { kategorija = p; break; }
    const popust =
        kategorija === 'TR5KM' ? 100 :
        kategorija === 'SXVC3' ? 50 :
        kategorija === 'MXRF1' ? 0 : null;

    return {
        ok: !resp.fault,
        ima_pravo: r.m_Item1 === true || r.m_Item1 === 'true',
        broj_osn_iskoristen: parseInt(r.m_Item2, 10) || 0,
        broj_dod_iskoristen: parseInt(r.m_Item3, 10) || 0,
        otok: r.m_Item4 || null,
        pravo_na_pp: r.m_Item5 || null,
        poruka,
        kategorija_popusta: kategorija,
        popust_postotak: popust,
        raw: { httpStatus: resp.httpStatus, fault: resp.fault },
    };
}

module.exports = { provjeriPPP };
