const axios = require('axios');
const jwt = require('jsonwebtoken');
const { getMainServiceConfigData } = require('../controllers/configServices/configSyncController');

// Log spajanja partnera (Sistem → „API partneri"). Jedan zapis po zahtjevu, i
// kad prođe i kad ne prođe: krivi ili istekao token, kriva kontrolna oznaka,
// rate limit, neispravan JSON, greška servisa.
//
// Middleware stoji ispred svega ostalog, a zapis se radi na `finish` — tada je
// poznat status koji je partner dobio. Servis nema bazu, pa zapis ide u auth
// servis, bez čekanja: odgovor partneru ne smije kasniti zbog loga.
//
// Ne bilježi se ništa tajno: otp, token, ključ (k) ni control_code.

const PRESKOCI = ['/documentation'];

// Sadržaj zahtjeva i odgovora ide u log, ali bez tajni: polja s ovim imenima se
// maskiraju bilo gdje u strukturi. Odgovor prijave nosi token, zahtjev otp i
// control_code.
const TAJNA_POLJA = new Set(['otp', 'control_code', 'token', 'access_token', 'refresh_token', 'k', 'key', 'password', 'authorization']);
const MAX_ZNAKOVA = 20000;

const maskiraj = (v, dubina = 0) => {
    if (dubina > 8 || v == null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map((x) => maskiraj(x, dubina + 1));
    const out = {};
    for (const [k, x] of Object.entries(v)) {
        // Interna polja koja dodaju naši middlewarei (__order_number) nisu
        // ono što je partner poslao.
        if (k.startsWith('__')) continue;
        out[k] = TAJNA_POLJA.has(k.toLowerCase()) ? '***' : maskiraj(x, dubina + 1);
    }
    return out;
};

const uTekst = (v) => {
    if (v == null) return null;
    let s;
    if (typeof v === 'string') {
        // Tekstualni odgovor može biti JSON — tada se i on maskira.
        try { s = JSON.stringify(maskiraj(JSON.parse(v))); } catch { s = v; }
    } else if (Buffer.isBuffer(v)) {
        s = `[binarni sadržaj, ${v.length} B]`;
    } else {
        try { s = JSON.stringify(maskiraj(v)); } catch { s = String(v); }
    }
    return s.length > MAX_ZNAKOVA ? `${s.slice(0, MAX_ZNAKOVA)}… [odrezano, ukupno ${s.length} znakova]` : s;
};

const posalji = (zapis) => {
    try {
        const authUrl = getMainServiceConfigData()?.services?.auth?.url;
        if (!authUrl) return;
        axios.post(`${authUrl}/admin/partner_api_logs`, zapis, { timeout: 5000, validateStatus: () => true })
            .catch((e) => console.log('[api-log] zapis nije uspio:', e?.message || e));
    } catch (e) {
        console.log('[api-log] zapis nije uspio:', e?.message || e);
    }
};

// Kod odbijenog tokena req.partner ne postoji; tko je zvao zna se iz samog
// tokena (bez provjere potpisa — samo za evidenciju, ne za pristup).
const izTokena = (req) => {
    try {
        const h = req.headers['authorization'] || '';
        const t = String(h).startsWith('Bearer ') ? String(h).slice(7) : null;
        const p = t ? jwt.decode(t) : null;
        return p ? { api_user_uuid: p.api_user_uuid, partner_uuid: p.partner_uuid, partner_acr: p.partner_acr, tid: p.tid } : {};
    } catch {
        return {};
    }
};

const apiLog = (req, res, next) => {
    const putanja = String(req.originalUrl || req.url || '').split('?')[0];
    if (PRESKOCI.includes(putanja)) return next();

    const t0 = Date.now();
    let porukaGreske = null;
    let odgovor;
    let odgovorZabiljezen = false;
    const izvorniJson = res.json.bind(res);
    res.json = (tijelo) => {
        if (res.statusCode >= 400) porukaGreske = tijelo?.msg || tijelo?.message || null;
        // res.json zove send sa stringom — zapisuje se prvi, izvorni oblik.
        if (!odgovorZabiljezen) { odgovor = tijelo; odgovorZabiljezen = true; }
        return izvorniJson(tijelo);
    };
    const izvorniSend = res.send.bind(res);
    res.send = (tijelo) => {
        // Rate limit i Expressove greške šalju preko send-a.
        if (res.statusCode >= 400 && !porukaGreske) {
            porukaGreske = typeof tijelo === 'string' ? tijelo.slice(0, 500) : (tijelo?.msg || tijelo?.message || null);
        }
        if (!odgovorZabiljezen) { odgovor = tijelo; odgovorZabiljezen = true; }
        return izvorniSend(tijelo);
    };

    res.on('finish', () => {
        const tko = req.partner || izTokena(req);
        const tijelo = req.body && typeof req.body === 'object' ? req.body : {};
        posalji({
            method: req.method,
            path: putanja,
            status_code: res.statusCode,
            duration_ms: Date.now() - t0,
            ip_address: req.ip || null,
            user_agent: req.headers['user-agent'] || null,
            api_user_uuid: tko.api_user_uuid || null,
            partner_uuid: tko.partner_uuid || null,
            partner_acr: tko.partner_acr || null,
            // Kod prijave TID stiže u tijelu zahtjeva.
            tid: tko.tid || tijelo.tid || null,
            error_msg: porukaGreske,
            order_number: tijelo.order_number || tijelo.__order_number || null,
            // GET nema tijela; tada se bilježi upit (?...), ako ga ima.
            request_body: uTekst(Object.keys(tijelo).length ? tijelo : (Object.keys(req.query || {}).length ? req.query : null)),
            response_body: uTekst(odgovor),
        });
    });
    next();
};

module.exports = { apiLog };
