const { getYescorConfig, getAccessToken, getTenantOib, getTenant } = require('../integrations/yescorClient');

// GET endpoint za brzi test YesCor auth flow-a.
// Vraća da li je config postavljen + da li OAuth token fetch prolazi.
const yescorHealthController = async (req, res) => {
    try {
        const cfg = getYescorConfig();
        if (!cfg) {
            return res.status(200).json({
                status: 200,
                data: { ok: false, reason: 'yescor config missing in integrations_configs.json' },
            });
        }
        const missing = ['token_url', 'api_url', 'client_id', 'client_secret', 'app_secret']
            .filter((k) => !cfg[k] || String(cfg[k]).startsWith('TODO'));
        if (missing.length) {
            return res.status(200).json({
                status: 200,
                data: { ok: false, reason: `missing/TODO fields: ${missing.join(', ')}`, environment: cfg.environment },
            });
        }
        // Probaj dobiti token
        let token = null;
        let tokenError = null;
        try { token = await getAccessToken(); } catch (e) { tokenError = e?.message || String(e); }
        // Probaj dohvatiti tenant (potvrđuje da i app_secret header radi)
        let tenantResp = null;
        let tenantError = null;
        if (token) {
            try {
                const r = await getTenant();
                tenantResp = { status: r.status, data: r.data };
            } catch (e) { tenantError = e?.message || String(e); }
        }
        return res.status(200).json({
            status: 200,
            data: {
                ok: Boolean(token) && tenantResp?.status >= 200 && tenantResp?.status < 300,
                environment: cfg.environment,
                api_url: cfg.api_url,
                tenant_oib_from_config: getTenantOib(),
                token_prefix: token ? (String(token).slice(0, 30) + '…') : null,
                token_error: tokenError,
                tenant_response: tenantResp,
                tenant_error: tenantError,
            },
        });
    } catch (error) {
        console.log('yescorHealthController error:', error?.message || error);
        return res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { yescorHealthController };
