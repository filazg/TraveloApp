// YesCor (Seyfor ExchangeHub) client — F2 fiscalization za HR.
// OAuth2 (client_credentials) token + POST invoice API.
// Config se čita iz control-service /integrations_config endpointa.
const axios = require('axios');
const { getIntegrationsConfigData } = require('../configSyncController');

let _cachedToken = null;
let _cachedTokenExpiresAt = 0;

const getYescorConfig = () => {
    const all = getIntegrationsConfigData() || {};
    return all.yescor || null;
};

const getTenantOib = () => {
    const all = getIntegrationsConfigData() || {};
    return all.tenant?.oib || null;
};

// Dohvat OAuth2 bearer token-a (client_credentials grant). Keše-ira se do
// 60 sekundi prije isteka da se ne mora svaki put pozivati token endpoint.
const getAccessToken = async () => {
    const cfg = getYescorConfig();
    if (!cfg?.token_url || !cfg?.client_id || !cfg?.client_secret) {
        throw new Error('YesCor config missing: token_url/client_id/client_secret');
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (_cachedToken && nowSec < _cachedTokenExpiresAt - 60) {
        return _cachedToken;
    }
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: cfg.client_id,
        client_secret: cfg.client_secret,
    });
    const resp = await axios.post(cfg.token_url, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
        validateStatus: () => true,
    });
    if (resp.status >= 400 || !resp.data?.access_token) {
        throw new Error(`YesCor token endpoint failed: ${resp.status} ${JSON.stringify(resp.data)}`);
    }
    _cachedToken = resp.data.access_token;
    _cachedTokenExpiresAt = nowSec + Number(resp.data.expires_in || 300);
    return _cachedToken;
};

// Generički API poziv sa Bearer tokenom + app_secret headerom. Koristi ga
// sendInvoice/getInvoiceStatus/itd.
const callYescorApi = async (method, path, body = null) => {
    const cfg = getYescorConfig();
    if (!cfg?.api_url) throw new Error('YesCor api_url not configured');
    if (!cfg?.app_secret || cfg.app_secret.startsWith('TODO')) {
        throw new Error('YesCor app_secret not set — check integrations_configs.json');
    }
    const token = await getAccessToken();
    const url = cfg.api_url.replace(/\/$/, '') + path;
    const resp = await axios({
        method,
        url,
        data: body,
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-ClientApplication-Secret': cfg.app_secret,
            'Content-Type': 'application/json',
        },
        timeout: 30000,
        validateStatus: () => true,
    });
    return { status: resp.status, data: resp.data, headers: resp.headers };
};

// Posalji UBL 2.1 XML račun na YesCor. YesCor očekuje base64-encoded XML file.
// Vraća document_id i status koji se pohranjuju u invoice.yescor_* poljima.
//
// documentType 1 = invoice. Ostali tipovi: 2=credit note, 3=debit note (ovisi o
// YesCor specifikaciji — provjeriti u swaggeru kasnije).
const sendInvoice = async (ublXml, { fileName = `invoice_${Date.now()}.xml`, documentType = 1 } = {}) => {
    const base64 = Buffer.from(String(ublXml), 'utf8').toString('base64');
    return callYescorApi('POST', '/document/submit', {
        documentType,
        mainFile: {
            fileName,
            mimeType: 'application/xml',
            data: base64,
        },
        deliveryWithoutEinvoice: false,
    });
};

// Pre-validacija XML-a prije pravog slanja (bez fiskalizacije).
// DocumentValidateDto ima drugačiji shape od submit — samo `data` top-level.
const validateInvoice = async (ublXml, { documentType = 1 } = {}) => {
    const base64 = Buffer.from(String(ublXml), 'utf8').toString('base64');
    return callYescorApi('POST', '/document/validate', {
        documentType,
        data: base64,
    });
};

// Status check po YesCor document_id (korisno za retry/poll).
const getDocumentStatus = async (documentId) => {
    return callYescorApi('GET', `/document/${encodeURIComponent(documentId)}/status`);
};

// Dohvat tenant info — koristi se za ping / sanity check da API key radi.
const getTenant = async () => {
    return callYescorApi('GET', '/tenant');
};

module.exports = {
    getYescorConfig,
    getTenantOib,
    getAccessToken,
    callYescorApi,
    sendInvoice,
    validateInvoice,
    getDocumentStatus,
    getTenant,
};
