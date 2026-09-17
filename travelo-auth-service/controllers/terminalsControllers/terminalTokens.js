const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const TERMINALS_JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET";
// Access TTL je konfigurabilan zbog rollouta: stari klijenti (bez refresh
// logike) trebaju dulji access dok se ne azuriraju. Skrati (npr. '1h') tek kad
// su svi desk/mobile klijenti u polju azurirani. Default '1h'.
const ACCESS_TTL = process.env.TERMINAL_ACCESS_TTL || "1h";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // klizni refresh: 30 dana

// Access je JWT (verificira ga gateway kao i dosad); typ:access je informativan,
// stari tokeni bez typ i dalje prolaze verifikaciju (backward-compat).
const signAccess = (terminalUuid) =>
    jwt.sign({ t: terminalUuid, typ: "access" }, TERMINALS_JWT_SECRET, { expiresIn: ACCESS_TTL });

const noviRefresh = () => crypto.randomBytes(48).toString("hex");
const zaMjesec = () => new Date(Date.now() + REFRESH_TTL_MS);

// Prijava/uparivanje: izda svjež par i ROTIRA store (jedan aktivan refresh po
// terminalu — obriši stare pa upiši novi).
const issueTokensForTerminal = async (models, terminalUuid) => {
    const { TerminalRefreshTokensModel } = models;
    const refresh = noviRefresh();
    if (TerminalRefreshTokensModel) {
        await TerminalRefreshTokensModel.destroy({ where: { terminal_uuid: terminalUuid } });
        await TerminalRefreshTokensModel.create({
            terminal_uuid: terminalUuid,
            refresh_token: refresh,
            expires_at: zaMjesec(),
            revoked: false,
        });
    }
    return { token: signAccess(terminalUuid), refresh_token: refresh };
};

// Refresh: provjeri predani refresh u storeu; ako je valjan → novi access + novi
// refresh (rotacija) i pomakni istek (+30d). Vraća null ako nije valjan/istekao.
const rotateRefresh = async (models, refreshToken) => {
    const { TerminalRefreshTokensModel } = models;
    if (!TerminalRefreshTokensModel || !refreshToken) return null;
    const row = await TerminalRefreshTokensModel.findOne({ where: { refresh_token: refreshToken } });
    if (!row || row.revoked) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;
    const refresh = noviRefresh();
    row.refresh_token = refresh;
    row.expires_at = zaMjesec();
    await row.save();
    return { token: signAccess(row.terminal_uuid), refresh_token: refresh, terminal_uuid: row.terminal_uuid };
};

// Opoziv (npr. pri unpair/deaktivaciji terminala).
const revokeForTerminal = async (models, terminalUuid) => {
    const { TerminalRefreshTokensModel } = models;
    if (!TerminalRefreshTokensModel) return;
    await TerminalRefreshTokensModel.destroy({ where: { terminal_uuid: terminalUuid } });
};

module.exports = { signAccess, issueTokensForTerminal, rotateRefresh, revokeForTerminal, ACCESS_TTL };
