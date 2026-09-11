const axios = require('axios');
const { getCoreServiceConfigData } = require('../../controllers/configServices/configSyncController');

// SEOP administracija.
//
// Postavke stoje u boat servisu, a certifikati i provjera veze u akd servisu,
// jer ondje leži privatni ključ i odande se zove AKD. Portal treba jedan ekran,
// pa se ovdje spaja — sučelje ne mora znati koji servis drži koji dio.

const url = (core, servis) => core?.services?.[servis]?.url;

// OIB brodara prema AKD-u je OIB same tvrtke. Ekran ga prikazuje, ali ne dira —
// mijenja se u Administracija -> Tvrtka, gdje mu je i mjesto.
const oibTvrtke = async (core) => {
    const boUrl = url(core, 'backoffice');
    if (!boUrl) return null;
    try {
        const r = await axios.get(`${boUrl}/company`, { timeout: 8000, validateStatus: () => true });
        return r.status === 200 ? (r.data?.data?.company?.legal_id || null) : null;
    } catch (_) {
        return null;
    }
};

const handleGetSeopSettingsFeature = async (req, res) => {
    try {
        const core = await getCoreServiceConfigData();
        const boatUrl = url(core, 'boat');
        const akdUrl = url(core, 'akd');

        const [postavke, certifikati, oib] = await Promise.all([
            boatUrl
                ? axios.get(`${boatUrl}/seop_settings`, { timeout: 10000, validateStatus: () => true })
                : Promise.resolve(null),
            // Stanje datoteka na disku je korisno, ali nije uvjet: ekran se mora
            // otvoriti i kad akd servis ne radi.
            akdUrl
                ? axios.get(`${akdUrl}/seop/cert-info`, { timeout: 10000, validateStatus: () => true })
                    .catch(() => null)
                : Promise.resolve(null),
            oibTvrtke(core),
        ]);

        const s = postavke?.data?.data?.settings || null;
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'seopSettings',
                data: {
                    settings: s ? { ...s, brodarev_oib: oib || s.brodarev_oib || null } : null,
                    certs: certifikati?.data?.data?.certs || null,
                    akd_dostupan: !!certifikati,
                },
            },
        });
    } catch (error) {
        console.log('handleGetSeopSettingsFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleUpdateSeopSettingsFeature = async (req, res) => {
    try {
        const core = await getCoreServiceConfigData();
        const boatUrl = url(core, 'boat');
        if (!boatUrl) throw new Error('boat servis nije u konfiguraciji');

        const r = await axios.post(`${boatUrl}/seop_settings`, req.body?.body || req.body || {}, {
            timeout: 10000,
            validateStatus: () => true,
        });
        res.status(r.status).send(r.data);
    } catch (error) {
        console.log('handleUpdateSeopSettingsFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Datoteka dolazi kao base64 u tijelu — certifikati su mali (kilobajti), pa se
// izbjegava multipart i jedan sloj knjižnica u svakom servisu na putu.
const handleUploadSeopCertFeature = async (req, res) => {
    try {
        const core = await getCoreServiceConfigData();
        const akdUrl = url(core, 'akd');
        if (!akdUrl) throw new Error('akd servis nije u konfiguraciji');

        const r = await axios.post(`${akdUrl}/seop/cert`, req.body?.body || req.body || {}, {
            timeout: 20000,
            maxBodyLength: Infinity,
            validateStatus: () => true,
        });
        res.status(r.status).send(r.data);
    } catch (error) {
        console.log('handleUploadSeopCertFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleSeopTestFeature = async (req, res) => {
    try {
        const core = await getCoreServiceConfigData();
        const akdUrl = url(core, 'akd');
        if (!akdUrl) throw new Error('akd servis nije u konfiguraciji');

        const r = await axios.post(`${akdUrl}/seop/test-veze`, {}, {
            timeout: 30000,
            validateStatus: () => true,
        });
        res.status(r.status).send(r.data);
    } catch (error) {
        console.log('handleSeopTestFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// --- MOSI ---
// Isti raspored: postavke u boat servisu, certifikat i provjera veze u akd.
const handleGetMosiSettingsFeature = async (req, res) => {
    try {
        const core = await getCoreServiceConfigData();
        const boatUrl = url(core, 'boat');
        const akdUrl = url(core, 'akd');

        const [postavke, cert, oib] = await Promise.all([
            boatUrl
                ? axios.get(`${boatUrl}/mosi_settings`, { timeout: 10000, validateStatus: () => true })
                : Promise.resolve(null),
            akdUrl
                ? axios.get(`${akdUrl}/mosi/cert-info`, { timeout: 10000, validateStatus: () => true })
                    .catch(() => null)
                : Promise.resolve(null),
            oibTvrtke(core),
        ]);

        const s = postavke?.data?.data?.settings || null;
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'mosiSettings',
                data: {
                    settings: s ? { ...s, oib_pu: oib || s.oib_pu || null } : null,
                    cert: cert?.data?.data?.cert || null,
                    akd_dostupan: !!cert,
                },
            },
        });
    } catch (error) {
        console.log('handleGetMosiSettingsFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleUpdateMosiSettingsFeature = async (req, res) => {
    try {
        const core = await getCoreServiceConfigData();
        const boatUrl = url(core, 'boat');
        if (!boatUrl) throw new Error('boat servis nije u konfiguraciji');
        const r = await axios.post(`${boatUrl}/mosi_settings`, req.body?.body || req.body || {}, {
            timeout: 10000,
            validateStatus: () => true,
        });
        res.status(r.status).send(r.data);
    } catch (error) {
        console.log('handleUpdateMosiSettingsFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleUploadMosiCertFeature = async (req, res) => {
    try {
        const core = await getCoreServiceConfigData();
        const akdUrl = url(core, 'akd');
        if (!akdUrl) throw new Error('akd servis nije u konfiguraciji');
        const r = await axios.post(`${akdUrl}/mosi/cert`, req.body?.body || req.body || {}, {
            timeout: 20000,
            maxBodyLength: Infinity,
            validateStatus: () => true,
        });
        res.status(r.status).send(r.data);
    } catch (error) {
        console.log('handleUploadMosiCertFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleMosiTestFeature = async (req, res) => {
    try {
        const core = await getCoreServiceConfigData();
        const akdUrl = url(core, 'akd');
        if (!akdUrl) throw new Error('akd servis nije u konfiguraciji');
        const r = await axios.post(`${akdUrl}/mosi/test-veze`, {}, {
            timeout: 30000,
            validateStatus: () => true,
        });
        res.status(r.status).send(r.data);
    } catch (error) {
        console.log('handleMosiTestFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    handleGetMosiSettingsFeature,
    handleUpdateMosiSettingsFeature,
    handleUploadMosiCertFeature,
    handleMosiTestFeature,
    handleGetSeopSettingsFeature,
    handleUpdateSeopSettingsFeature,
    handleUploadSeopCertFeature,
    handleSeopTestFeature,
};
