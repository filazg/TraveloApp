import axios from 'axios';
import { DEFAULT_GATEWAY_URL } from './config';
import { loadGateway, loadToken, saveGateway, saveToken, clearToken, saveTid, loadTid } from '../db/repo';

// Shared axios instance. Base URL and token are injected from SQLite (via repo)
// on each request via interceptor so we don't have to restart the app after pairing.
const api = axios.create({ timeout: 20000 });

// DEV override — debug build uvijek ide na lokalni gateway preko adb reverse-a
// (tcp:5100 → host 5100). Tako ne moramo ručno re-pair-ati uređaj svaki put kad
// switchamo backend. Production build (__DEV__ = false) koristi SQLite gateway.
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

export const storage = {
    async getGateway() { return (await loadGateway()) || DEFAULT_GATEWAY_URL; },
    async setGateway(url) { if (url) await saveGateway(url); },
    async getToken() { return loadToken(); },
    async setToken(token) { if (token) await saveToken(token); },
    async clearToken() { await clearToken(); },
    async getTid() { return loadTid(); },
    async setTid(tid) { if (tid) await saveTid(tid); },
};

export default api;
