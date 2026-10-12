const axios = require('axios');
const { getMainServiceConfigData } = require('../controllers/configSyncController');

// Log komunikacije naplatnih uređaja (desk i mobilna) — Sistem → „Komunikacija
// uređaja". Jedan zapis po zahtjevu, i kad prođe i kad ne prođe: odbijen ili
// istekao token, servis ne odgovara, prazan plovidbeni red.
//
// Zašto u gatewayu: svi pozivi uređaja (/terminals/... i /terminal_auth/...)
// prolaze ovuda, pa se vidi i ono što nikad ne stigne do terminals servisa —
// odbijen token, pad servisa, prekinuta veza.
//
// Odgovori uređaju znaju biti veliki (plovidbeni red s tisućama polazaka), pa
// se uz skraćeni sadržaj sprema i sažetak: koliko je zapisa došlo u kojem
// popisu. Po sažetku se odmah vidi da je, recimo, stiglo 0 linija.
//
// Zapis ide u auth servis bez čekanja — odgovor uređaju ne smije kasniti zbog
// loga. Tajne (otp, token, refresh_token) se ne bilježe.

const PREFIKSI = ['/terminals/', '/terminal_auth/'];

const TAJNA_POLJA = new Set(['otp', 'token', 'access_token', 'refresh_token', 'password', 'authorization', 'key', 'k']);
const MAX_ZNAKOVA = 20000;
// Iz dugog popisa ostaje nekoliko prvih zapisa, da se vidi oblik.
const ZADRZI_U_POPISU = 3;

const maskiraj = (v, dubina = 0) => {
    if (dubina > 8 || v == null || typeof v !== 'object') return v;
    if (Array.isArray(v)) {
        const dio = v.slice(0, ZADRZI_U_POPISU).map((x) => maskiraj(x, dubina + 1));
        if (v.length > ZADRZI_U_POPISU) dio.push(`… još ${v.length - ZADRZI_U_POPISU} zapisa (ukupno ${v.length})`);
        return dio;
    }
    const out = {};
    for (const [k, x] of Object.entries(v)) {
        out[k] = TAJNA_POLJA.has(k.toLowerCase()) ? '***' : maskiraj(x, dubina + 1);
    }
    return out;
};

const uTekst = (v) => {
    if (v == null) return null;
    let s;
    if (Buffer.isBuffer(v)) {
        s = `[binarni sadržaj, ${v.length} B]`;
    } else if (typeof v === 'string') {
        try { s = JSON.stringify(maskiraj(JSON.parse(v))); } catch { s = v; }
    } else {
        try { s = JSON.stringify(maskiraj(v)); } catch { s = String(v); }
    }
    return s.length > MAX_ZNAKOVA ? `${s.slice(0, MAX_ZNAKOVA)}… [odrezano, ukupno ${s.length} znakova]` : s;
};

// "harbors: 20 · lines: 7 · sales_routes: 7224" — broj zapisa u svakom popisu
// na vrhu odgovora (i jednu razinu ispod, ako je odgovor umotan u .data).
const sazetak = (tijelo) => {
    if (!tijelo || typeof tijelo !== 'object' || Buffer.isBuffer(tijelo)) return null;
    if (Array.isArray(tijelo)) return `zapisa: ${tijelo.length}`;
    const dijelovi = [];
    const skupi = (o, prefiks) => {
        for (const [k, x] of Object.entries(o)) {
            if (Array.isArray(x)) dijelovi.push(`${prefiks}${k}: ${x.length}`);
            else if (!prefiks && x && typeof x === 'object' && k === 'data') skupi(x, 'data.');
        }
    };
    skupi(tijelo, '');
    if (tijelo.unchanged === true) dijelovi.push('bez promjena');
    return dijelovi.length ? dijelovi.join(' · ').slice(0, 1000) : null;
};

// Uređaj se prepoznaje iz tokena (t = uuid naplatnog uređaja). Potpis se ne
// provjerava — služi samo za evidenciju, pristup odobrava auth servis.
const izTokena = (req) => {
    try {
        const h = String(req.headers['authorization'] || '');
        const t = h.startsWith('Bearer ') ? h.slice(7) : null;
        if (!t) return null;
        const dio = t.split('.')[1];
        if (!dio) return null;
        const p = JSON.parse(Buffer.from(dio.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'));
        return p?.t || null;
    } catch {
        return null;
    }
};

const posalji = (zapis) => {
    try {
        const authUrl = getMainServiceConfigData()?.services?.auth?.url;
        if (!authUrl) return;
        axios.post(`${authUrl}/admin/terminal_logs`, zapis, { timeout: 5000, validateStatus: () => true })
            .catch((e) => console.log('[terminal-log] zapis nije uspio:', e?.message || e));
    } catch (e) {
        console.log('[terminal-log] zapis nije uspio:', e?.message || e);
    }
};

const terminalLog = (req, res, next) => {
    const putanja = String(req.originalUrl || req.url || '').split('?')[0];
    if (!PREFIKSI.some((p) => putanja.startsWith(p))) return next();

    const t0 = Date.now();
    let odgovor;
    let odgovorZabiljezen = false;
    const izvorniJson = res.json.bind(res);
    res.json = (tijelo) => {
        if (!odgovorZabiljezen) { odgovor = tijelo; odgovorZabiljezen = true; }
        return izvorniJson(tijelo);
    };
    const izvorniSend = res.send.bind(res);
    res.send = (tijelo) => {
        // res.json zove send sa stringom — zapisuje se prvi, izvorni oblik.
        if (!odgovorZabiljezen) { odgovor = tijelo; odgovorZabiljezen = true; }
        return izvorniSend(tijelo);
    };

    // `close` dolazi uvijek, i kad je odgovor poslan i kad je veza prekinuta
    // prije odgovora (uređaj odustao, gateway nije odgovorio).
    res.once('close', () => {
        const tijelo = req.body && typeof req.body === 'object' ? req.body : {};
        const dovrseno = res.writableFinished;
        const sse = String(res.getHeader('content-type') || '').includes('text/event-stream');
        let porukaGreske = null;
        if (!dovrseno && !sse) porukaGreske = 'Veza prekinuta prije odgovora';
        else if (res.statusCode >= 400) {
            const o = typeof odgovor === 'string' ? (() => { try { return JSON.parse(odgovor); } catch { return { msg: odgovor }; } })() : odgovor;
            porukaGreske = o?.msg || o?.message || o?.error || null;
            if (porukaGreske && typeof porukaGreske !== 'string') porukaGreske = JSON.stringify(porukaGreske);
        }
        posalji({
            method: req.method,
            path: putanja,
            status_code: dovrseno || sse ? res.statusCode : null,
            duration_ms: Date.now() - t0,
            ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null,
            user_agent: req.headers['user-agent'] || null,
            terminal_uuid: izTokena(req),
            // Kod prijave i javljanja verzije TID stiže u tijelu.
            tid: tijelo.tid || null,
            client: tijelo.client || null,
            error_msg: porukaGreske,
            response_summary: sse ? 'otvorena veza za javljanje promjena' : sazetak(odgovor),
            request_body: uTekst(Object.keys(tijelo).length ? tijelo : (Object.keys(req.query || {}).length ? req.query : null)),
            response_body: sse ? null : uTekst(odgovor),
        });
    });
    next();
};

module.exports = { terminalLog };
