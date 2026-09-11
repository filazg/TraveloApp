const axios = require('axios');
const { getCoreServiceConfigData } = require('../../controllers/configServices/configSyncController');

// SEOP administracija.
//
// Postavke stoje u boat servisu, a certifikati i provjera veze u akd servisu,
// jer ondje leži privatni ključ i odande se zove AKD. Portal treba jedan ekran,
// pa se ovdje spaja — sučelje ne mora znati koji servis drži koji dio.

const url = (core, servis) => core?.services?.[servis]?.url;

const handleGetSeopSettingsFeature = async (req, res) => {
    try {
        const core = await getCoreServiceConfigData();
        const boatUrl = url(core, 'boat');
        const akdUrl = url(core, 'akd');

        const [postavke, certifikati] = await Promise.all([
            boatUrl
                ? axios.get(`${boatUrl}/seop_settings`, { timeout: 10000, validateStatus: () => true })
                : Promise.resolve(null),
            // Stanje datoteka na disku je korisno, ali nije uvjet: ekran se mora
            // otvoriti i kad akd servis ne radi.
            akdUrl
                ? axios.get(`${akdUrl}/seop/cert-info`, { timeout: 10000, validateStatus: () => true })
                    .catch(() => null)
                : Promise.resolve(null),
        ]);

        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'seopSettings',
                data: {
                    settings: postavke?.data?.data?.settings || null,
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

module.exports = {
    handleGetSeopSettingsFeature,
    handleUpdateSeopSettingsFeature,
    handleUploadSeopCertFeature,
    handleSeopTestFeature,
};
