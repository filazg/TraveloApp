// Admin uvidi za portal (modul Administracija): log prijava + uređaji/verzije.
// Pristup ograničen na jednog korisnika (isto kao desk_updater).
const { getLoginLogsController, getDeviceConnectionsController, getAkdLogsController, getPartnerApiLogsController, getPartnerApiLogController } = require('../../controllers/coreServiceControllers/authServiceControllers/adminLogsServiceControllers');

const ALLOWED_USERS = (process.env.DESK_UPDATER_USERS || 'nfilipec')
    .split(',').map((s) => s.trim()).filter(Boolean);

const jeAdmin = (req) => {
    const username = req.body?.header?.username;
    return !!username && ALLOWED_USERS.includes(username);
};

const handleGetLoginLogsFeature = async (req, res) => {
    try {
        if (!jeAdmin(req)) return res.status(403).send({ status: 403, data: { message: 'Pristup ograničen.' } });
        const data = await getLoginLogsController(req.query?.limit);
        return res.send({ status: 200, data: { logs: data?.logs || [] } });
    } catch (error) {
        console.log('handleGetLoginLogsFeature error:', error?.message || error);
        return res.status(500).send({ status: 500, data: { message: 'Greška pri dohvatu logova.' } });
    }
};

const handleGetDeviceConnectionsFeature = async (req, res) => {
    try {
        if (!jeAdmin(req)) return res.status(403).send({ status: 403, data: { message: 'Pristup ograničen.' } });
        const data = await getDeviceConnectionsController();
        return res.send({ status: 200, data: { devices: data?.devices || [] } });
    } catch (error) {
        console.log('handleGetDeviceConnectionsFeature error:', error?.message || error);
        return res.status(500).send({ status: 500, data: { message: 'Greška pri dohvatu uređaja.' } });
    }
};

// Zapis poziva prema AKD-u. Filtri dolaze u tijelu, ne u upitu: zahtjev ionako
// mora biti POST da kroz gateway stigne zaglavlje s korisnikom.
const handleGetAkdLogsFeature = async (req, res) => {
    try {
        if (!jeAdmin(req)) return res.status(403).send({ status: 403, data: { message: 'Pristup ograničen.' } });
        const f = req.body?.body || {};
        const data = await getAkdLogsController({
            from: f.from || undefined,
            to: f.to || undefined,
            terminal_uuid: f.terminal_uuid || undefined,
            iskaznica: f.iskaznica || undefined,
            sustav: f.sustav || undefined,
            metoda: f.metoda || undefined,
            samo: f.samo || undefined,
            limit: f.limit || undefined,
        });
        return res.send({ status: 200, data });
    } catch (error) {
        console.log('handleGetAkdLogsFeature error:', error?.message || error);
        return res.status(500).send({ status: 500, data: { message: 'Greška pri dohvatu AKD loga.' } });
    }
};

// Log spajanja partnera preko API-ja. Filtri u tijelu, kao kod AKD loga.
const handleGetPartnerApiLogsFeature = async (req, res) => {
    try {
        if (!jeAdmin(req)) return res.status(403).send({ status: 403, data: { message: 'Pristup ograničen.' } });
        const f = req.body?.body || {};
        const data = await getPartnerApiLogsController({
            from: f.from || undefined,
            to: f.to || undefined,
            partner_uuid: f.partner_uuid || undefined,
            tid: f.tid || undefined,
            samo: f.samo || undefined,
            status: f.status || undefined,
            path: f.path || undefined,
            limit: f.limit || undefined,
        });
        return res.send({ status: 200, data: { logs: data?.logs || [], total: data?.total || 0 } });
    } catch (error) {
        console.log('handleGetPartnerApiLogsFeature error:', error?.message || error);
        return res.status(500).send({ status: 500, data: { message: 'Greška pri dohvatu API loga.' } });
    }
};

// Jedan zapis sa sadržajem zahtjeva i odgovora (detalj).
const handleGetPartnerApiLogFeature = async (req, res) => {
    try {
        if (!jeAdmin(req)) return res.status(403).send({ status: 403, data: { message: 'Pristup ograničen.' } });
        const id = req.body?.body?.id;
        if (!id) return res.status(400).send({ status: 400, data: { message: 'Nedostaje id zapisa.' } });
        const data = await getPartnerApiLogController(id);
        return res.send({ status: 200, data: { log: data?.log || null } });
    } catch (error) {
        console.log('handleGetPartnerApiLogFeature error:', error?.message || error);
        return res.status(500).send({ status: 500, data: { message: 'Greška pri dohvatu zapisa.' } });
    }
};

module.exports = { handleGetLoginLogsFeature, handleGetDeviceConnectionsFeature, handleGetAkdLogsFeature, handleGetPartnerApiLogsFeature, handleGetPartnerApiLogFeature };
