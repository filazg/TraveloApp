// Admin uvidi: log prijava portala + zadnje stanje uređaja (verzija/spajanje).
// Read endpointe zove web_portal-service (BFF) izravno (server-to-server); upis
// heartbeata (terminalReport) šalje desk/mobile pri pokretanju preko gatewaya.

const klijentIp = (req) => {
    const xff = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
    return xff || req.socket?.remoteAddress || req.ip || null;
};

// GET — zadnjih N prijava portala (uspješne i neuspjele), najnovije prvo.
const getLoginLogsController = async (req, res) => {
    try {
        const { LoginLogsModel } = req.app.locals.models;
        const limit = Math.min(Number(req.query.limit) || 500, 2000);
        const logs = await LoginLogsModel.findAll({
            order: [["createdAt", "DESC"]],
            limit,
        });
        return res.status(200).json({ logs: logs.map((l) => l.toJSON()) });
    } catch (error) {
        console.log("getLoginLogsController error:", error?.message || error);
        return res.status(500).json({ message: "Internal error" });
    }
};

// GET — zadnje stanje po uređaju (jedan redak po TID-u), najnovije viđeni prvo.
const getDeviceConnectionsController = async (req, res) => {
    try {
        const { DeviceConnectionsModel } = req.app.locals.models;
        const devices = await DeviceConnectionsModel.findAll({
            order: [["last_seen", "DESC"]],
        });
        return res.status(200).json({ devices: devices.map((d) => d.toJSON()) });
    } catch (error) {
        console.log("getDeviceConnectionsController error:", error?.message || error);
        return res.status(500).json({ message: "Internal error" });
    }
};

// POST — uređaj se javio pri pokretanju: { tid, app_version, client }. Upsert
// po TID-u (zadnje stanje). Telemetrija — ako TID ne postoji, tiho ignoriramo
// (bez greške).
const terminalReportController = async (req, res) => {
    try {
        const { TerminalsModel, DeviceConnectionsModel } = req.app.locals.models;
        // Ide kroz gateway (terminal_auth, is_login) koji radi
        // res.status(resp.data.status).json(resp.data.data) — pa MORAMO vratiti
        // omotač { status, data }, inače gateway padne i klijent čeka do timeouta.
        const { tid, app_version, client } = req.body || {};
        if (!tid) return res.status(200).json({ status: 200, data: { msg: "ignored" } });

        const terminal = await TerminalsModel.findOne({ where: { tid } });
        if (!terminal) return res.status(200).json({ status: 200, data: { msg: "ignored" } });

        const vrijednosti = {
            tid,
            terminal_uuid: terminal.uuid,
            client: client || null,
            app_version: app_version || null,
            ip_address: klijentIp(req),
            last_seen: new Date(),
        };
        const postojeci = await DeviceConnectionsModel.findOne({ where: { tid } });
        if (postojeci) {
            await postojeci.update(vrijednosti);
        } else {
            await DeviceConnectionsModel.create(vrijednosti);
        }
        return res.status(200).json({ status: 200, data: { msg: "ok" } });
    } catch (error) {
        console.log("terminalReportController error:", error?.message || error);
        // Ne rušimo klijenta zbog telemetrije.
        return res.status(200).json({ status: 200, data: { msg: "error" } });
    }
};

module.exports = {
    getLoginLogsController,
    getDeviceConnectionsController,
    terminalReportController,
};
