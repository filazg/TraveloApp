const path = require('path');
const axios = require('axios');

const { loadP12, digSign } = require('../seop/seopCrypto');
const { dohvatiPostavke, osnovniUrl, apiKljuc, rijecZaPotpis } = require('./mosiController');

// Dojava korištenja invalidske povlastice u brodskom prijevozu.
//
// MOSI je REST/JSON: nema SOAP-a ni klijentskog certifikata za vezu — pružatelj
// se predstavlja API ključem u zaglavlju. Certifikat služi samo za potpis
// podataka dojave, a AKD provjerava potpis javnim ključem koji mu predamo.
const MAPA_CERT = path.join(__dirname, '..', '..', 'cert');

// Vrijeme u JSON obliku, lokalno, do sekunde — bez tisućinki i bez zone.
// Isti oblik ide i u riječ za potpis i u tijelo zahtjeva; razlika bi značila
// potpis koji ne odgovara poslanim podacima.
function vrijemeMosi(d) {
    const dt = d instanceof Date ? d : new Date(d);
    const p = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
        + `T${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`;
}

// Decimalni razdjelnik je točka, razdjelnik tisućica zabranjen. Iznos se
// zapisuje jednako u potpisu i u tijelu.
const iznos = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};

function kljuc(postavke) {
    const ime = postavke.p12_file;
    if (!ime) throw new Error('potpisni certifikat nije postavljen');
    return loadP12(path.join(MAPA_CERT, path.basename(ime)), postavke.p12_password || '').key;
}

// Dojava utroška — v2/dojavautroska/brodari.
//
// `opisUsluge` je ujedno i put za storno: dojava s opisom
// "STORNO - <oznaka izvorne>" poništava raniju.
async function dojaviUtrosak({
    oznakaUsluge,
    opisUsluge,
    oibOsi = null,
    uuidOsi = null,
    sbrOsi = null,
    oznakaPrava,
    brojLinije,
    luka1,
    luka2,
    punaCijena,
    naplaceno,
    vrijemeUsluge,
    storno = false,
}) {
    const postavke = await dohvatiPostavke();

    if (!postavke.enabled) return { ok: false, preskoceno: true, poruka: 'MOSI dojava je isključena u postavkama' };
    if (postavke.environment === 'mock') return { ok: false, preskoceno: true, poruka: 'okolina je mock' };
    if (storno && postavke.send_storno === false) return { ok: false, preskoceno: true, poruka: 'storno dojave je isključen' };
    if (!storno && postavke.send_utrosak === false) return { ok: false, preskoceno: true, poruka: 'dojava utroška je isključena' };

    const kljucApi = apiKljuc(postavke);
    if (!kljucApi) return { ok: false, preskoceno: true, poruka: `API ključ za okolinu "${postavke.environment}" nije postavljen` };
    if (!oibOsi && !uuidOsi && !sbrOsi) throw new Error('nedostaje identifikator nositelja prava');

    const vrijeme = vrijemeMosi(vrijemeUsluge);
    const puna = iznos(punaCijena);
    const placeno = iznos(naplaceno);

    const potpis = digSign(rijecZaPotpis({
        apiKey: kljucApi,
        oibPU: postavke.oib_pu,
        IDOsobaPU: postavke.id_osoba_pu,
        oznakaUsluge,
        opisUsluge,
        punaCijena: puna,
        naplaceno: placeno,
        vrijemeUsluge: vrijeme,
    }), kljuc(postavke));

    const tijelo = {
        apiKey: kljucApi,
        oibPU: postavke.oib_pu,
        IDOsobaPU: postavke.id_osoba_pu,
        oznakaUsluge,
        opisUsluge,
        NositeljPrava_oibOsi: oibOsi || null,
        NositeljPrava_uuidOsi: uuidOsi || null,
        NositeljPrava_sbrOsi: sbrOsi || null,
        oznakaPrava,
        brojLinije: String(brojLinije ?? ''),
        luka1,
        luka2,
        punaCijena: puna,
        naplaceno: placeno,
        vrijemeUsluge: vrijeme,
        digSig: potpis,
    };

    const url = `${osnovniUrl(postavke)}/api/uslugewebapi/v2/dojavautroska/brodari`;
    const r = await axios.post(url, tijelo, {
        timeout: 20000,
        validateStatus: () => true,
        headers: { 'Content-Type': 'application/json' },
    });

    // MOSI i uspješan poziv prati upozorenjima (nema aktivne iskaznice, nema
    // prava, premašena godišnja količina). Dojava je zaprimljena, ali ured to
    // mora vidjeti — pa se upozorenja vraćaju pozivatelju, ne gutaju.
    const upozorenja = Array.isArray(r.data?.upozorenja) ? r.data.upozorenja : [];
    return {
        ok: r.status === 200,
        http: r.status,
        upozorenja,
        poruka: r.status === 200
            ? (upozorenja.length ? upozorenja.map((u) => `${u.sifra}: ${u.naziv}`).join('; ') : null)
            : (r.data?.message || r.data?.opis || `MOSI je odgovorio statusom ${r.status}`),
    };
}

module.exports = { dojaviUtrosak, vrijemeMosi };
