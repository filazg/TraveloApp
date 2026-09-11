const fs = require('fs');
const path = require('path');
const axios = require('axios');
const forge = require('node-forge');

const { getCoreServiceConfigData, getIntegrationsConfigData } = require('../configSyncController');
const { dohvatiOibTvrtke } = require('../oibTvrtke');

// MOSI (AKD) — dojava korištenja invalidskih povlastica.
//
// Za razliku od SEOP-a ovo je REST/JSON i ne traži klijentski certifikat za
// spajanje: pružatelj se predstavlja API ključem. Certifikat služi samo za
// potpis dojave utroška, a AKD-u se predaje njegov javni ključ.
//
// Postavke stižu iz boat servisa (tablica `mosi_settings`), koju ured uređuje
// u portalu.
const MAPA = path.join(__dirname, '..', '..', 'cert');
const TRAJANJE_MS = 10000;

let spremljeno = null;
let spremljenoU = 0;

async function dohvatiPostavke({ svjeze = false } = {}) {
    if (!svjeze && spremljeno && Date.now() - spremljenoU < TRAJANJE_MS) return spremljeno;
    const boatUrl = getCoreServiceConfigData()?.services?.boat?.url;
    if (!boatUrl) throw new Error('boat servis nije u konfiguraciji');
    const r = await axios.get(`${boatUrl}/mosi_settings/internal`, {
        timeout: 8000,
        validateStatus: () => true,
    });
    if (r.status !== 200 || !r.data?.data?.settings) throw new Error('postavke MOSI-ja nisu dostupne');
    // OIB ustanove koja dojavljuje je OIB tvrtke — isti izvor kao i kod SEOP-a.
    const oib = await dohvatiOibTvrtke();
    spremljeno = { ...r.data.data.settings, oib_pu: oib || r.data.data.settings.oib_pu || null };
    spremljenoU = Date.now();
    return spremljeno;
}

function ocistiSpremnik() {
    spremljeno = null;
    spremljenoU = 0;
}

const osnovniUrl = (postavke) => {
    const cfg = getIntegrationsConfigData()?.akd?.mosi || {};
    return postavke.environment === 'prod'
        ? (cfg.url_prod || 'https://mosi-extapi.akd.hr')
        : (cfg.url_test || 'https://demo-mosi-extapi.akd.hr');
};

const apiKljuc = (postavke) => (postavke.environment === 'prod'
    ? postavke.api_key_prod
    : postavke.api_key_test);

// Riječ za potpis po pravilima MOSI-ja: razdjelnik su dvije podvlake, decimalna
// točka, vrijeme bez tisućinki, boolean malim slovima.
//
//   ApiKey__OibPU__IDOsobaPU__OznakaUsluge__OpisUsluge__PunaCijena__Naplaceno__VrijemeUsluge
function rijecZaPotpis(p) {
    return [
        p.apiKey, p.oibPU, p.IDOsobaPU, p.oznakaUsluge, p.opisUsluge,
        p.punaCijena, p.naplaceno, p.vrijemeUsluge,
    ].join('__');
}

const sigurnoIme = (ime) => {
    const osnova = path.basename(String(ime || '')).replace(/[^A-Za-z0-9._-]/g, '_');
    return osnova || 'mosi.p12';
};

function opisP12(putanja, lozinka) {
    const buf = fs.readFileSync(putanja);
    const asn1 = forge.asn1.fromDer(buf.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, lozinka);
    let cert = null;
    for (const sadrzaj of p12.safeContents) {
        for (const bag of sadrzaj.safeBags) {
            if (bag.type === forge.pki.oids.certBag && !cert) cert = bag.cert;
        }
    }
    if (!cert) throw new Error('u datoteci nema certifikata');
    const nositelj = (cert.subject?.attributes || [])
        .map((a) => `${a.shortName || a.name}=${a.value}`)
        .join(', ');
    return { subject: nositelj, valid_to: cert.validity?.notAfter || null };
}

// POST /mosi/cert — { naziv, sadrzaj_base64, lozinka }
const uploadMosiCertController = async (req, res) => {
    try {
        const data = req.body?.body || req.body || {};
        if (!data.sadrzaj_base64) {
            return res.status(400).json({ status: 400, data: { message: 'nedostaje sadržaj datoteke' } });
        }
        fs.mkdirSync(MAPA, { recursive: true });
        const ime = sigurnoIme(data.naziv);
        const putanja = path.join(MAPA, ime);
        fs.writeFileSync(putanja, Buffer.from(String(data.sadrzaj_base64), 'base64'));

        let opis;
        try {
            opis = opisP12(putanja, String(data.lozinka ?? ''));
        } catch (e) {
            fs.unlinkSync(putanja);
            return res.status(400).json({
                status: 400,
                data: { message: `Certifikat se ne može otvoriti: ${e.message}. Provjerite lozinku.` },
            });
        }

        const boatUrl = getCoreServiceConfigData()?.services?.boat?.url;
        const izmjene = {
            p12_file: ime,
            p12_password: String(data.lozinka ?? ''),
            p12_subject: opis.subject,
            p12_valid_to: opis.valid_to,
            p12_uploaded_at: new Date(),
        };
        const r = await axios.post(`${boatUrl}/mosi_settings/cert`, izmjene, {
            timeout: 8000,
            validateStatus: () => true,
        });
        if (r.status !== 200) throw new Error(`boat servis nije spremio opis certifikata (HTTP ${r.status})`);
        ocistiSpremnik();

        res.json({ status: 200, data: { file: ime, subject: opis.subject, valid_to: opis.valid_to } });
    } catch (error) {
        console.log('uploadMosiCertController error:', error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

const mosiCertInfoController = async (_req, res) => {
    try {
        const postavke = await dohvatiPostavke({ svjeze: true });
        const ime = postavke.p12_file;
        const putanja = ime ? path.join(MAPA, path.basename(ime)) : null;
        res.json({
            status: 200,
            data: {
                cert: { file: ime || null, postoji: !!(putanja && fs.existsSync(putanja)) },
                p12_subject: postavke.p12_subject || null,
                p12_valid_to: postavke.p12_valid_to || null,
                p12_uploaded_at: postavke.p12_uploaded_at || null,
            },
        });
    } catch (error) {
        console.log('mosiCertInfoController error:', error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// POST /mosi/test-veze — katalog invalidskih prava. Metoda je čitanje, ne
// dojava, pa je najjeftiniji dokaz da API ključ i mreža rade.
const mosiTestVezeController = async (_req, res) => {
    try {
        const postavke = await dohvatiPostavke({ svjeze: true });
        if (postavke.environment === 'mock') {
            return res.json({
                status: 200,
                data: { ok: false, message: 'Okolina je "mock" — prema MOSI-ju se ništa ne šalje.' },
            });
        }
        const kljuc = apiKljuc(postavke);
        if (!kljuc) {
            return res.json({
                status: 200,
                data: { ok: false, message: `API ključ za okolinu "${postavke.environment}" nije postavljen.` },
            });
        }

        const url = `${osnovniUrl(postavke)}/api/uslugewebapi/v2/katalozi/invalidskaprava`;
        const r = await axios.get(url, {
            timeout: 20000,
            validateStatus: () => true,
            headers: { apiKey: kljuc, 'Content-Type': 'application/json' },
        });
        const ok = r.status === 200;
        res.json({
            status: 200,
            data: {
                ok,
                url,
                environment: postavke.environment,
                http: r.status,
                message: ok
                    ? 'Veza radi — MOSI je vratio katalog prava.'
                    : (r.data?.message || r.data?.opis || `MOSI je odgovorio statusom ${r.status}.`),
            },
        });
    } catch (error) {
        console.log('mosiTestVezeController error:', error?.message || error);
        res.json({ status: 200, data: { ok: false, message: error.message } });
    }
};

module.exports = {
    dohvatiPostavke,
    ocistiSpremnik,
    osnovniUrl,
    apiKljuc,
    rijecZaPotpis,
    uploadMosiCertController,
    mosiCertInfoController,
    mosiTestVezeController,
};
