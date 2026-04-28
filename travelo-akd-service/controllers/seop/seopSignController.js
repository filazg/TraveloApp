const path = require('path');
const { getIntegrationsConfigData } = require('../configSyncController');
const { loadP12, digSign, zkb } = require('./seopCrypto');
const { opkZkbRaw, opkSignRaw, ppkZkbRaw, ppkSignRaw } = require('./seopStringBuilders');

function resolveCerts() {
    const cfg = getIntegrationsConfigData()?.akd?.seop || {};
    const p12Path = cfg.p12_path
        ? path.resolve(cfg.p12_path)
        : path.join(__dirname, '..', '..', 'cert', 'kapetan-luka.p12');
    const p12Pass = cfg.p12_password || process.env.AKD_P12_PASS || '';
    return { p12Path, p12Pass };
}

// Dijagnostika: POST /seop/sign-test → vraća ZKB + digSig za zadani tip i polja.
// Tijelo: { type: "opk"|"ppk", params: {...} }
const seopSignTestController = async (req, res) => {
    try {
        const { type = 'opk', params = {} } = req.body || {};
        const { p12Path, p12Pass } = resolveCerts();
        const { key, cert } = loadP12(p12Path, p12Pass);

        const zkbRaw = type === 'ppk' ? ppkZkbRaw(params) : opkZkbRaw(params);
        const zkbHex = zkb(zkbRaw, key);

        const signRaw = type === 'ppk'
            ? ppkSignRaw({ ...params, zkb: zkbHex })
            : opkSignRaw({ ...params, zkb: zkbHex });
        const digSig = digSign(signRaw, key);

        res.json({
            status: 200,
            data: {
                cert_subject: cert.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(', '),
                cert_valid_to: cert.validity.notAfter.toISOString(),
                zkb_raw: zkbRaw,
                zkb: zkbHex,
                sign_raw: signRaw,
                digSig,
            },
        });
    } catch (err) {
        console.log('seopSignTestController error:', err?.message || err);
        res.status(500).json({ status: 500, data: { message: err.message } });
    }
};

module.exports = { seopSignTestController };
