const https = require('https');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { XMLParser } = require('fast-xml-parser');
const { getIntegrationsConfigData } = require('../configSyncController');
const { loadP12 } = require('./seopCrypto');
const { dohvatiPostavke } = require('./seopSettings');

// Certifikati stoje u `cert/` mapi ovog servisa. Postavka nosi samo ime
// datoteke; starije instalacije imaju relativnu putanju iz konfiguracije, pa se
// podnosi i to.
const MAPA_CERT = path.join(__dirname, '..', '..', 'cert');
const razrijesiPutanju = (ime) => {
    if (!ime) return null;
    return ime.includes('/') || ime.includes('\\')
        ? path.resolve(__dirname, '..', '..', ime)
        : path.join(MAPA_CERT, ime);
};

// Pošalje SOAP envelope na SEOP s mTLS (klijentski p12 cert).
// Vraća { httpStatus, headers, body, parsed, fault, soapAction }.
//
// SEOP envelope ide u text/xml; SOAPAction header je u formatu
// "SEOP.AKD/IServiceName/MetodName" — točan namespace WSDL definira; mi
// koristimo "SEOP.AKD/" + metoda jer je u dosadašnjim primjerima radilo s
// targetNamespace="SEOP.AKD".
async function callSeop({ method, bodyXml, soapAction }) {
    const cfg = getIntegrationsConfigData()?.akd?.seop || {};
    // Okolina, certifikat i lozinke dolaze iz postavki koje ured uređuje u
    // portalu; iz datoteke ostaju samo URL-ovi, koje AKD ne mijenja.
    const postavke = await dohvatiPostavke();
    const env = postavke.environment === 'prod' ? 'prod' : 'test';
    const url = env === 'prod' ? cfg.url_prod : cfg.url_test;
    if (!url) throw new Error('akd.seop URL nije konfiguriran u integrations_configs.json');

    const p12Path = razrijesiPutanju(postavke.p12_file)
        || path.join(__dirname, '..', '..', 'cert', 'kapetan-luka.p12');
    const p12Pass = postavke.p12_password || '';

    // Node 22 ne prihvaća legacy PKCS12 enkripciju (RC2-40); konvertiramo u PEM.
    const { keyPem, certPem } = loadP12(p12Path, p12Pass);
    // Oblik akcije je iz WSDL-a servisa: SEOP.AKD/IPlovKarte/<Metoda>. Bez
    // naziva sucelja WCF poziv odbija.
    const action = soapAction || `SEOP.AKD/IPlovKarte/${method}`;

    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:seop="SEOP.AKD" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header/>
  <soapenv:Body>${bodyXml}</soapenv:Body>
</soapenv:Envelope>`;

    const u = new URL(url);
    const opts = {
        method: 'POST',
        host: u.hostname,
        port: u.port || 443,
        path: u.pathname + (u.search || ''),
        key: keyPem,
        cert: certPem,
        // SEOP je stari WCF servis — forsiramo TLS 1.2 i ciphers koje on podržava.
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.2',
        rejectUnauthorized: postavke.tls_reject_unauthorized === true,
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': `"${action}"`,
            'Connection': 'close',
        },
    };

    // AKD-ov CA se DODAJE ugrađenim korijenima, ne zamjenjuje ih.
    //
    // Poslužitelj SEOP-a nosi javni Sectigo certifikat (*.akd.hr), a AKDCA-DEMO
    // je izdavatelj NAŠEG klijentskog certifikata. Postavljanje samo njega u `ca`
    // izbacuje javne korijene iz povjerenja, pa handshake padne na
    // „unable to get local issuer certificate" — server se nema čime provjeriti.
    const caPath = razrijesiPutanju(postavke.ca_file);
    if (caPath) {
        try {
            opts.ca = [...tls.rootCertificates, fs.readFileSync(caPath, 'utf8')];
            opts.rejectUnauthorized = true;
        } catch (e) {
            console.log('CA lanac se ne moze procitati, ostaju samo ugradeni korijeni:', e.message);
        }
    }

    return await new Promise((resolve, reject) => {
        const req = https.request(opts, (resp) => {
            const chunks = [];
            resp.on('data', (c) => chunks.push(c));
            resp.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                let parsed = null;
                let fault = null;
                try {
                    const parser = new XMLParser({
                        ignoreAttributes: false,
                        attributeNamePrefix: '@_',
                        removeNSPrefix: true,
                    });
                    parsed = parser.parse(body);
                    const f = parsed?.Envelope?.Body?.Fault;
                    if (f) {
                        // SEOP ne zamata greške u statuse nego ih vraća kao SOAP
                        // Fault, a u detalju stoji klasa SeopGreska { Kod, Opis }
                        // (poglavlje 5.9 specifikacije). Ondje je i poslovni
                        // ishod — npr. „iskaznica ne postoji" — pa se mora
                        // izvući, inače blagajna vidi samo „Baza podataka".
                        const detalj = f.Detail || f.detail || null;
                        const greska = detalj?.SeopGreska || null;
                        fault = {
                            code: f.Code?.Value || f.faultcode || null,
                            reason: f.Reason?.Text || f.faultstring || null,
                            detail: detalj,
                            seop_kod: greska ? (parseInt(greska.Kod, 10) || null) : null,
                            seop_opis: greska ? String(greska.Opis || '').trim() : null,
                        };
                    }
                } catch (e) {
                    // body nije XML — vratit ćemo raw
                }
                resolve({ httpStatus: resp.statusCode, headers: resp.headers, body, parsed, fault, soapAction: action });
            });
        });
        req.on('error', reject);
        req.write(envelope);
        req.end();
    });
}

module.exports = { callSeop };
