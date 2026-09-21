import axios from 'axios';
import { DEFAULT_GATEWAY_URL, ENDPOINTS } from './config';
import {
    loadGateway, loadToken, saveGateway, saveToken, clearToken, saveTid, loadTid,
    loadRefreshToken, saveRefreshToken, clearRefreshToken,
} from '../db/repo';

// Shared axios instance. Base URL and token are injected from SQLite (via repo)
// on each request via interceptor so we don't have to restart the app after pairing.
const api = axios.create({ timeout: 20000 });

// DEV override — debug build ide na fiksni gateway, ne na upareni iz SQLite-a.
// Trenutno je uperen na LOKALNI terminals gateway (LAN IP ovog PC-a), da mobilna
// gađa lokalni backend s SEOP hookovima i lokalnim akd/certom. Za test protiv
// DO test okruženja vrati 'https://bookingtest.krilo.hr/app'.
// Production build (__DEV__ = false) koristi SQLite gateway.
const DEV_GATEWAY = 'http://localhost:5100';

api.interceptors.request.use(async (cfg) => {
    const gw = __DEV__ ? DEV_GATEWAY : ((await loadGateway()) || DEFAULT_GATEWAY_URL);
    cfg.baseURL = gw;
    if (!cfg.headers?.skipAuth) {
        const token = await loadToken();
        if (token) cfg.headers.Authorization = `Bearer ${token}`;
    }
    return cfg;
});

// Tiha obnova access tokena na 401. Interceptor dira ISKLJUČIVO tokene —
// nikad TID, transakcije, offline red ni smjene. Pri neuspjelom refreshu briše
// samo access + refresh token; ponovno uparivanje/prijava se okidaju drugdje
// (autoPair pri sljedećem pokretanju).
let refreshing = null; // in-flight refresh promise (dijeli ga više paralelnih 401)

async function runRefresh() {
    const refreshToken = await loadRefreshToken();
    if (!refreshToken) return null;
    // skipAuth: ne šaljemo (istekli) Bearer; ovaj poziv preskače interceptor petlju.
    const resp = await api.post(
        ENDPOINTS.terminalRefresh,
        { refresh_token: refreshToken },
        { headers: { skipAuth: true } },
    );
    const body = resp?.data?.data || resp?.data || {};
    if (!body.token) return null;
    await saveToken(body.token);
    if (body.refresh_token) await saveRefreshToken(body.refresh_token);
    return body.token;
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const cfg = error?.config;
        const status = error?.response?.status;

        // Ne diraj: ne-401, sam refresh poziv, skipAuth zahtjevi, već pokušani retry.
        if (
            status !== 401 ||
            !cfg ||
            cfg._retry ||
            cfg.headers?.skipAuth ||
            (cfg.url && cfg.url.includes(ENDPOINTS.terminalRefresh))
        ) {
            return Promise.reject(error);
        }

        try {
            // Jedan in-flight refresh dijele svi paralelni 401-i.
            if (!refreshing) refreshing = runRefresh();
            const newToken = await refreshing;
            refreshing = null;

            if (!newToken) {
                // Nema/nevaljan refresh — očisti SAMO tokene (ne TID, ne podatke).
                await clearToken();
                await clearRefreshToken();
                return Promise.reject(error);
            }

            // Ponovi originalni zahtjev jednom, s novim tokenom.
            cfg._retry = true;
            cfg.headers = cfg.headers || {};
            cfg.headers.Authorization = `Bearer ${newToken}`;
            return api(cfg);
        } catch (refreshErr) {
            refreshing = null;
            // Refresh pao (npr. 401 na refresh) — očisti samo tokene, propagiraj izvornu grešku.
            await clearToken();
            await clearRefreshToken();
            return Promise.reject(error);
        }
    },
);

// Heartbeat: javi poslužitelju TID + verziju aplikacije pri pokretanju, da se u
// administraciji vidi s kojom se verzijom uređaj spaja. Fire-and-forget —
// telemetrija ne smije utjecati na rad; skipAuth (endpoint provjerava TID).
export async function reportDeviceVersion() {
    try {
        const tid = await loadTid();
        if (!tid) return;
        const pkg = require('../../package.json');
        await api.post(
            ENDPOINTS.terminalReport,
            { tid, app_version: pkg.version, client: 'mobile' },
            { headers: { skipAuth: true } },
        );
    } catch (e) {
        // tiho — telemetrija
    }
}

export const storage = {
    async getGateway() { return (await loadGateway()) || DEFAULT_GATEWAY_URL; },
    async setGateway(url) { if (url) await saveGateway(url); },
    async getToken() { return loadToken(); },
    async setToken(token) { if (token) await saveToken(token); },
    async clearToken() { await clearToken(); },
    async getRefreshToken() { return loadRefreshToken(); },
    async setRefreshToken(token) { if (token) await saveRefreshToken(token); },
    async clearRefreshToken() { await clearRefreshToken(); },
    async getTid() { return loadTid(); },
    async setTid(tid) { if (tid) await saveTid(tid); },
};

export default api;
