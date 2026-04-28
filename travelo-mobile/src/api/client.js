import axios from 'axios';
import { DEFAULT_GATEWAY_URL } from './config';
import { loadGateway, loadToken, saveGateway, saveToken, clearToken } from '../db/repo';

// Shared axios instance. Base URL and token are injected from SQLite (via repo)
// on each request via interceptor so we don't have to restart the app after pairing.
const api = axios.create({ timeout: 20000 });

api.interceptors.request.use(async (cfg) => {
    const gw = (await loadGateway()) || DEFAULT_GATEWAY_URL;
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
};

export default api;
