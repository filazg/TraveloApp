const fs = require('fs');
const crypto = require('crypto');
const forge = require('node-forge');

// Učitaj p12, izvuci privatni ključ + cert i drži u memoriji za cijeli proces.
// SEOP digSig = RSA-SHA256 potpis ASCII stringa od konkateniranih parametara
// (bez razdvajača, redoslijed iz spec-a), izlaz Base64.
// ZKB = MD5 iste raw signature (ne Base64), zapisan kao 32-znak hex lowercase.

let cachedKey = null;       // crypto.KeyObject (private) — za potpisivanje
let cachedCert = null;      // forge certificate — za inspekciju subject/validity
let cachedKeyPem = null;    // PEM string privatnog ključa — za https.request
let cachedCertPem = null;   // PEM string javnog certifikata — za https.request

function loadP12(p12Path, password) {
    if (cachedKey) return { key: cachedKey, cert: cachedCert, keyPem: cachedKeyPem, certPem: cachedCertPem };

    const buf = fs.readFileSync(p12Path);
    const p12Asn1 = forge.asn1.fromDer(buf.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    let privateKey = null;
    let clientCert = null;

    for (const safeContent of p12.safeContents) {
        for (const bag of safeContent.safeBags) {
            if (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag && !privateKey) {
                privateKey = bag.key;
            } else if (bag.type === forge.pki.oids.certBag && !clientCert) {
                clientCert = bag.cert;
            }
        }
    }
    if (!privateKey || !clientCert) {
        throw new Error('p12 ne sadrži očekivani par private key + cert');
    }

    cachedKeyPem = forge.pki.privateKeyToPem(privateKey);
    cachedCertPem = forge.pki.certificateToPem(clientCert);
    cachedKey = crypto.createPrivateKey(cachedKeyPem);
    cachedCert = clientCert;
    return { key: cachedKey, cert: cachedCert, keyPem: cachedKeyPem, certPem: cachedCertPem };
}

// RSA-SHA256 potpis ASCII stringa → Base64.
function digSign(plaintext, privateKey) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(Buffer.from(plaintext, 'ascii'));
    signer.end();
    const sig = signer.sign(privateKey);
    return sig.toString('base64');
}

// ZKB = MD5(raw RSA-SHA256 signature bytes), 32 hex lowercase.
function zkb(plaintext, privateKey) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(Buffer.from(plaintext, 'ascii'));
    signer.end();
    const sig = signer.sign(privateKey);
    return crypto.createHash('md5').update(sig).digest('hex');
}

// Verifikacija SEOP potpisa odgovora (RSA-SHA256 javnim ključem iz tstseopsign.cert).
function verifySeopSignature(plaintext, signatureBase64, seopCertPem) {
    const pubKey = crypto.createPublicKey(seopCertPem);
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(Buffer.from(plaintext, 'ascii'));
    verifier.end();
    return verifier.verify(pubKey, Buffer.from(signatureBase64, 'base64'));
}

// Format datuma za SEOP string koji se potpisuje: 2019-01-03T05:00:00 (bez ms, bez TZ).
function fmtSeopDate(d) {
    const pad = (n) => String(n).padStart(2, '0');
    // Blagajna šalje datum polaska u hrvatskom formatu "DD.MM.YYYY. HH:mm"
    // (i varijante bez razmaka / sa sekundama), a `new Date()` ga ne parsira pa
    // je izlazio NaN i SEOP bi za krivi datum javio „nema prava". Prepoznaje se
    // ručno; ISO nizovi i Date objekti idu dalje kroz Date.
    if (typeof d === 'string') {
        const m = d.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (m) {
            const [, dd, mm, yyyy, hh, min, ss] = m;
            return `${yyyy}-${pad(mm)}-${pad(dd)}T${pad(hh)}:${pad(min)}:${pad(ss || 0)}`;
        }
    }
    const dt = d instanceof Date ? d : new Date(d);
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

// Novi certifikat ne vrijedi dok se ne zaboravi stari: kljuc se drzi u
// memoriji za cijeli proces, pa bi se bez ovoga i dalje potpisivalo prethodnim.
function resetP12Cache() {
    cachedKey = null;
    cachedCert = null;
    cachedKeyPem = null;
    cachedCertPem = null;
}

module.exports = {
    loadP12,
    resetP12Cache,
    digSign,
    zkb,
    verifySeopSignature,
    fmtSeopDate,
};
