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

// GET — LOG javljanja uređaja (svaki login/heartbeat), najnovije prvo. Uz
// TID/klijent/verziju nosi i username (kad je poznat). Kartica "Uređaji i
// verzije" ga prikazuje i filtrira (korisnik/uređaj/verzija) na klijentu.
const getDeviceConnectionsController = async (req, res) => {
    try {
        const { DeviceLoginLogsModel } = req.app.locals.models;
        const limit = Math.min(Number(req.query.limit) || 1000, 5000);
        const devices = await DeviceLoginLogsModel.findAll({
            order: [["createdAt", "DESC"]],
            limit,
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
        const { TerminalsModel, DeviceConnectionsModel, DeviceLoginLogsModel } = req.app.locals.models;
        // Ide kroz gateway (terminal_auth, is_login) koji radi
        // res.status(resp.data.status).json(resp.data.data) — pa MORAMO vratiti
        // omotač { status, data }, inače gateway padne i klijent čeka do timeouta.
        const { tid, app_version, client, username } = req.body || {};
        if (!tid) return res.status(200).json({ status: 200, data: { msg: "ignored" } });

        const terminal = await TerminalsModel.findOne({ where: { tid } });
        if (!terminal) return res.status(200).json({ status: 200, data: { msg: "ignored" } });

        const ip = klijentIp(req);

        // Zadnje stanje po uređaju (upsert) — brzi uvid u trenutnu verziju.
        const zadnjeStanje = {
            tid,
            terminal_uuid: terminal.uuid,
            client: client || null,
            app_version: app_version || null,
            ip_address: ip,
            last_seen: new Date(),
        };
        const postojeci = await DeviceConnectionsModel.findOne({ where: { tid } });
        if (postojeci) {
            await postojeci.update(zadnjeStanje);
        } else {
            await DeviceConnectionsModel.create(zadnjeStanje);
        }

        // Povijest javljanja (append) — svaki login/heartbeat, uz username.
        await DeviceLoginLogsModel.create({
            tid,
            terminal_uuid: terminal.uuid,
            client: client || null,
            app_version: app_version || null,
            username: username || null,
            ip_address: ip,
        });

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
