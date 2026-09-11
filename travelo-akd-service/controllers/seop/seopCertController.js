const fs = require('fs');
const path = require('path');
const axios = require('axios');
const forge = require('node-forge');

const { getCoreServiceConfigData } = require('../configSyncController');
const { resetP12Cache } = require('./seopCrypto');
const { dohvatiPostavke, ocistiSpremnik, urlZaOkolinu } = require('./seopSettings');
const { callSeop } = require('./soapClient');

// Certifikati za SEOP. Ured ih učitava iz portala; datoteke ostaju na stroju na
// kojem radi ovaj servis, jer se privatni ključ ne šalje dalje niti sprema u
// bazu. U bazi ostaje samo opis (ime datoteke, nositelj, rok) da se u portalu
// vidi što je postavljeno i dokad vrijedi.
const MAPA = path.join(__dirname, '..', '..', 'cert');

const VRSTE = {
    // klijentski certifikat s privatnim ključem — njime se potpisuje i spaja
    p12: { nastavak: '.p12', polje: 'p12_file' },
    // CA lanac SEOP poslužitelja — bez njega se server ne provjerava
    ca: { nastavak: '.crt', polje: 'ca_file' },
    // javni ključ SEOP-a — njime se provjerava potpis odgovora
    sign: { nastavak: '.cert', polje: 'sign_cert_file' },
};

const sigurnoIme = (ime, nastavak) => {
    const osnova = path.basename(String(ime || '')).replace(/[^A-Za-z0-9._-]/g, '_');
    if (!osnova) return `seop${nastavak}`;
    return osnova.includes('.') ? osnova : osnova + nastavak;
};

// Nositelj i rok valjanosti iz p12 — da ured u portalu vidi je li učitao pravi
// certifikat i kad istječe, bez otvaranja datoteke na poslužitelju.
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

async function javiBoatServisu(izmjene) {
    const boatUrl = getCoreServiceConfigData()?.services?.boat?.url;
    if (!boatUrl) throw new Error('boat servis nije u konfiguraciji');
    const r = await axios.post(`${boatUrl}/seop_settings/cert`, izmjene, {
        timeout: 8000,
        validateStatus: () => true,
    });
    if (r.status !== 200) throw new Error(`boat servis nije spremio opis certifikata (HTTP ${r.status})`);
}

// POST /seop/cert — { vrsta, naziv, sadrzaj_base64, lozinka? }
const uploadSeopCertController = async (req, res) => {
    try {
        const data = req.body?.body || req.body || {};
        const vrsta = VRSTE[String(data.vrsta || '').toLowerCase()];
        if (!vrsta) {
            return res.status(400).json({ status: 400, data: { message: 'vrsta mora biti p12, ca ili sign' } });
        }
        if (!data.sadrzaj_base64) {
            return res.status(400).json({ status: 400, data: { message: 'nedostaje sadržaj datoteke' } });
        }

        fs.mkdirSync(MAPA, { recursive: true });
        const ime = sigurnoIme(data.naziv, vrsta.nastavak);
        const putanja = path.join(MAPA, ime);
        fs.writeFileSync(putanja, Buffer.from(String(data.sadrzaj_base64), 'base64'));

        const izmjene = { [vrsta.polje]: ime };

        if (vrsta === VRSTE.p12) {
            // Lozinka se provjerava odmah: p12 koji se ne da otvoriti ne smije
            // ostati zapisan kao ispravan, inače prva dojava pada u produkciji.
            const lozinka = String(data.lozinka ?? '');
            try {
                const opis = opisP12(putanja, lozinka);
                izmjene.p12_password = lozinka;
                izmjene.p12_subject = opis.subject;
                izmjene.p12_valid_to = opis.valid_to;
                izmjene.p12_uploaded_at = new Date();
            } catch (e) {
                fs.unlinkSync(putanja);
                return res.status(400).json({
                    status: 400,
                    data: { message: `Certifikat se ne može otvoriti: ${e.message}. Provjerite lozinku.` },
                });
            }
            resetP12Cache();
        }

        await javiBoatServisu(izmjene);
        ocistiSpremnik();

        res.json({ status: 200, data: { file: ime, ...izmjene } });
    } catch (error) {
        console.log('uploadSeopCertController error:', error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// GET /seop/cert-info — što stvarno leži na disku. Portal tako razlikuje
// "zapisano u bazi" od "datoteka postoji".
const seopCertInfoController = async (_req, res) => {
    try {
        const postavke = await dohvatiPostavke({ svjeze: true });
        const stanje = {};
        for (const [kljuc, vrsta] of Object.entries(VRSTE)) {
            const ime = postavke[vrsta.polje];
            const putanja = ime ? path.join(MAPA, path.basename(ime)) : null;
            stanje[kljuc] = {
                file: ime || null,
                postoji: !!(putanja && fs.existsSync(putanja)),
            };
        }
        res.json({
            status: 200,
            data: {
                certs: stanje,
                p12_subject: postavke.p12_subject || null,
                p12_valid_to: postavke.p12_valid_to || null,
                p12_uploaded_at: postavke.p12_uploaded_at || null,
            },
        });
    } catch (error) {
        console.log('seopCertInfoController error:', error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// POST /seop/test-veze — dijagnostička metoda SEOP-a (DohvatiDatVremIzDB).
// Vraća vrijeme iz njihove baze, pa je najjeftiniji dokaz da certifikat,
// mreža i okolina rade prije nego se pošalje ijedna prava dojava.
const seopTestVezeController = async (_req, res) => {
    try {
        const postavke = await dohvatiPostavke({ svjeze: true });
        if (postavke.environment === 'mock') {
            return res.json({
                status: 200,
                data: { ok: false, message: 'Okolina je "mock" — prema SEOP-u se ništa ne šalje.' },
            });
        }
        if (!postavke.p12_file) {
            return res.json({
                status: 200,
                data: { ok: false, message: 'Klijentski certifikat nije učitan.' },
            });
        }

        const odgovor = await callSeop({
            method: 'DohvatiDatVremIzDB',
            bodyXml: '<seop:DohvatiDatVremIzDB/>',
        });
        const ok = odgovor.httpStatus === 200 && !odgovor.fault;
        res.json({
            status: 200,
            data: {
                ok,
                url: urlZaOkolinu(postavke),
                environment: postavke.environment,
                http: odgovor.httpStatus,
                message: ok
                    ? 'Veza radi — SEOP je odgovorio.'
                    : (odgovor.fault?.opis || odgovor.fault?.reason || 'SEOP nije prihvatio poziv.'),
                odgovor: odgovor.parsed || null,
            },
        });
    } catch (error) {
        console.log('seopTestVezeController error:', error?.message || error);
        res.json({ status: 200, data: { ok: false, message: error.message } });
    }
};

module.exports = {
    uploadSeopCertController,
    seopCertInfoController,
    seopTestVezeController,
};
