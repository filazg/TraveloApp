const https = require('https');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { XMLParser } = require('fast-xml-parser');
const { getIntegrationsConfigData } = require('../configSyncController');
const { zapisiPoziv, kontekstZapisa } = require('../../helpers/akdLog');
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
// `kontekst` nosi tko je poziv izazvao i na koju se iskaznicu odnosi. SOAP sloj
// to ne zna sam, a bez toga zapis u logu ne bi imalo po cemu filtrirati.
async function callSeop({ method, bodyXml, soapAction, kontekst = {} }) {
    const zapoceto = Date.now();
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

    // Poslovni ishod SEOP-a NIJE greska prijenosa: „Iskaznica nije pronadena
    // (MXRF1)" stigne kao uredan HTTP 200 bez Faulta. Da se u logu moze naci
    // zasto putniku pravo nije priznato, poruka se izvlaci i onda kad je poziv
    // tehnicki prosao.
    //
    // Cita se opcenito, bez znanja o metodi: pod Body stoji jedan <…Response>,
    // a u njemu jedan <…Result> s poljem Poruka. Sifra ishoda je sufiks te
    // poruke u zagradi (TR5KM, SXVC3, MXRF1).
    const poslovniIshod = (parsed) => {
        try {
            const body = parsed?.Envelope?.Body;
            if (!body) return null;
            const odgovor = Object.keys(body).find((k) => k.endsWith('Response'));
            if (!odgovor) return null;
            const rezultat = body[odgovor];
            const kljuc = Object.keys(rezultat || {}).find((k) => k.endsWith('Result'));
            const r = kljuc ? rezultat[kljuc] : null;
            const poruka = r && (r.Poruka ?? r.m_Item6);
            if (!poruka) return null;
            const tekst = String(typeof poruka === 'object' ? (poruka['#text'] ?? '') : poruka).trim();
            if (!tekst) return null;
            const m = tekst.match(/\(([A-Z0-9]{3,8})\)\s*$/);
            return { opis: tekst, kod: m ? m[1] : null };
        } catch (e) {
            return null;
        }
    };

    // Sve sto se dalje dogodi — uredan odgovor, SOAP Fault ili prekid veze —
    // zavrsi u logu. Zapis ide iz jedne tocke jer kroz nju prolaze SVI pozivi
    // prema SEOP-u (provjere, dojave, test veze).
    const zapisi = (dodatno) => zapisiPoziv({
        sustav: 'SEOP',
        metoda: method,
        okolina: env,
        trajanje_ms: Date.now() - zapoceto,
        zahtjev: envelope,
        ...kontekstZapisa(kontekst),
        ...dodatno,
    });

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
                // Fault je greska i kad stigne s HTTP 200; obratno, HTTP 500
                // bez Faulta je i dalje neuspjeh. Zato se `ok` izvodi iz oboje.
                const ishod = fault ? null : poslovniIshod(parsed);
                zapisi({
                    ok: !fault && resp.statusCode >= 200 && resp.statusCode < 300,
                    http_status: resp.statusCode,
                    greska_kod: fault ? (fault.seop_kod ?? fault.code ?? null) : (ishod?.kod || null),
                    greska_opis: fault ? (fault.seop_opis || fault.reason || null) : (ishod?.opis || null),
                    odgovor: body,
                });
                resolve({ httpStatus: resp.statusCode, headers: resp.headers, body, parsed, fault, soapAction: action });
            });
        });
        req.on('error', (e) => {
            // Prekinuta veza je najcesci kvar i nigdje ne ostavlja trag osim
            // ovdje — AKD u tom slucaju nije ni odgovorio.
            zapisi({ ok: false, greska_kod: e?.code || 'VEZA', greska_opis: e?.message || String(e) });
            reject(e);
        });
        req.write(envelope);
        req.end();
    });
}

module.exports = { callSeop };
