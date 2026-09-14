const { callSeop } = require('./soapClient');
const { fmtSeopDate } = require('./seopCrypto');
const { getIntegrationsConfigData } = require('../configSyncController');

// Mock odgovori dok ne dobijemo svježi p12. Brojevi iz AKD demo seta:
//   5xxxxxx — redovni otočanin (02P, 50% popust)
//   6xxxxxx — javna služba ili specijalno pravo (TR5KM, 100% popust)
//   7xxxxxx — vozilo (12P, 50%)
//   ostali — "nema prava".
function mockProvjeriPPP({ sBrOtIs, oznOtIs, iks, oib, regOzn }) {
    // Uzima se onaj identifikator koji je stigao — blagajna smije upisati broj
    // iskaznice, iksice ili OIB, pa mock mora reagirati na sve, inace se OIB na
    // testu uvijek vraca kao „nema prava" i ispada da je greska u aplikaciji.
    const id = String(sBrOtIs || oznOtIs || iks || oib || regOzn || '').trim();
    // Prva znamenka odlucuje o ishodu. Duljina je slobodna jer OIB ima 11
    // znamenki, a broj iskaznice sedam.
    const lead = /^[0-9]{6,13}$/.test(id) ? id[0] : null;

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
        return mockProvjeriPPP({ sBrOtIs, oznOtIs, iks, oib, regOzn });
    }

    // Redoslijed elemenata prati specifikaciju (oznOtIs, sBrOtIs, regOzn, iks,
    // oib, pa relacija). Sva cetiri rezervna identifikatora moraju ici van —
    // bez njih bi upis OIB-a ili broja iksice na blagajni tiho ostao neposlan i
    // SEOP bi uvijek odgovarao da prava nema.
    const bodyXml = `<seop:ProvjeriPPP>
        ${nilOr('oznOtIs', oznOtIs)}
        ${nilOr('sBrOtIs', sBrOtIs)}
        ${nilOr('regOzn', regOzn)}
        ${nilOr('iks', iks)}
        ${nilOr('oib', oib)}
        <seop:oznLuke1>${x(oznLuke1)}</seop:oznLuke1>
        <seop:oznLuke2>${x(oznLuke2)}</seop:oznLuke2>
        <seop:brLinije>${x(brLinije)}</seop:brLinije>
        <seop:datPut>${fmtSeopDate(datPut)}</seop:datPut>
      </seop:ProvjeriPPP>`;

    const resp = await callSeop({ method: 'ProvjeriPPP', bodyXml });
    return interpretResponse(resp);
}

// SEOP i poslovni ishod javlja kao SOAP Fault (poglavlje 5.9): nepostojeća ili
// poništena iskaznica nije kvar servisa nego odgovor na pitanje. Bez ovoga bi
// blagajna na takvu karticu pokazala „provjera nije prošla" i operater bi mislio
// da je pukla veza, umjesto da vidi da kartica ne vrijedi.
//
// Kodovi dolaze iz `SeopGreska.Kod`; popis raste kako ih susrećemo. Nepoznat kod
// ostaje tehnička greška — bolje nego tumačiti ga napamet.
const POSLOVNE_GRESKE = {
    50405: 'Iskaznica nije pronađena ili nije aktivna.',
};

function odgovorIzGreske(fault) {
    const poruka = POSLOVNE_GRESKE[fault.seop_kod];
    if (!poruka) return null;
    return {
        ok: true,
        ima_pravo: false,
        broj_osn_iskoristen: 0,
        broj_dod_iskoristen: 0,
        max_osn: null,
        max_dod: null,
        otok: null,
        ozn_otoka: null,
        pravo_na_pp: null,
        // Opis sa SEOP-a je konkretniji od našeg (kaže i koji je broj očitan),
        // pa ide putniku, a naš tekst ostaje kad opisa nema.
        poruka: fault.seop_opis || poruka,
        kategorija_popusta: null,
        popust_postotak: 0,
        seop_kod: fault.seop_kod,
    };
}

// `ProvjeriPPPResult` je klasa StanjePPP s imenovanim poljima — tako stoji u
// WSDL-u servisa (BrojDod, BrojOsn, ImaPravoNaPP, IznosPopusta, MaxDod, MaxOsn,
// Otok, OznOtoka, Poruka, PravoNaPP). Dojave prodaje jesu Tuple (m_Item1…), ali
// provjera nije; kod je dotad čitao tuple i na pravom servisu ne bi pročitao
// ništa.
//
// Stariji oblik ostaje kao rezerva, da se ne izgubi ono što je već radilo na
// zatečenoj okolini.
const prazno = (v) => v === null || v === undefined
    || (typeof v === 'object' && (v['@_nil'] === 'true' || v['@_xsi:nil'] === 'true'));
const vrijednost = (v) => (prazno(v) ? null : v);
const broj = (v) => {
    const n = parseInt(vrijednost(v), 10);
    return Number.isFinite(n) ? n : null;
};

function interpretResponse(resp) {
    if (resp.fault) {
        const poslovni = odgovorIzGreske(resp.fault);
        if (poslovni) return poslovni;
    }
    const r = resp.parsed?.Envelope?.Body?.ProvjeriPPPResponse?.ProvjeriPPPResult;
    if (!r) {
        return {
            ok: false,
            raw: resp,
            error: resp.fault?.seop_opis || resp.fault?.reason || 'unexpected response shape',
            seop_kod: resp.fault?.seop_kod || null,
        };
    }

    const imaPravo = vrijednost(r.ImaPravoNaPP) ?? vrijednost(r.m_Item1);
    const poruka = String(vrijednost(r.Poruka) ?? vrijednost(r.m_Item6) ?? '');

    const popusti = ['TR5KM', 'SXVC3', 'MXRF1'];
    let kategorija = null;
    for (const p of popusti) if (poruka.endsWith(p)) { kategorija = p; break; }

    // Postotak dolazi iz `IznosPopusta` kad ga servis pošalje; sufiks poruke
    // ostaje rezerva, jer je polje u specifikaciju dodano naknadno.
    const izPolja = broj(r.IznosPopusta);
    const izSufiksa =
        kategorija === 'TR5KM' ? 100 :
        kategorija === 'SXVC3' ? 50 :
        kategorija === 'MXRF1' ? 0 : null;

    return {
        ok: !resp.fault,
        ima_pravo: imaPravo === true || imaPravo === 'true',
        broj_osn_iskoristen: broj(r.BrojOsn) ?? broj(r.m_Item2) ?? 0,
        broj_dod_iskoristen: broj(r.BrojDod) ?? broj(r.m_Item3) ?? 0,
        max_osn: broj(r.MaxOsn),
        max_dod: broj(r.MaxDod),
        otok: vrijednost(r.Otok) ?? vrijednost(r.m_Item4) ?? null,
        ozn_otoka: broj(r.OznOtoka),
        pravo_na_pp: vrijednost(r.PravoNaPP) ?? vrijednost(r.m_Item5) ?? null,
        poruka,
        kategorija_popusta: kategorija,
        popust_postotak: izPolja !== null ? izPolja : izSufiksa,
        raw: { httpStatus: resp.httpStatus, fault: resp.fault },
    };
}

module.exports = { provjeriPPP };
