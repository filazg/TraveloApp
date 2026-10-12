const { DataTypes } = require("sequelize");

// Log komunikacije naplatnih uređaja (desk i mobilna) — Sistem → „Komunikacija
// uređaja". Jedan redak po zahtjevu uređaja prema poslužitelju, uspješnom i
// neuspjelom. Piše ga gateway (nema svoju bazu), čita portal preko
// web_portal-service (BFF).
//
// Ne sprema se ništa tajno: ni otp, ni token, ni refresh token.
module.exports = (sequelize) => {
    const TerminalLogsModel = sequelize.define(
        "terminal_logs",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            method: { type: DataTypes.STRING(10), allowNull: true },
            path: { type: DataTypes.STRING, allowNull: true },
            // NULL kad je veza prekinuta prije nego je uređaj dobio odgovor.
            status_code: { type: DataTypes.INTEGER, allowNull: true },
            ok: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
            duration_ms: { type: DataTypes.INTEGER, allowNull: true },
            ip_address: { type: DataTypes.STRING, allowNull: true },
            user_agent: { type: DataTypes.STRING(500), allowNull: true },

            // Koji uređaj: uuid iz tokena, TID iz šifarnika terminala (ili iz
            // tijela kod prijave), 'desk' | 'mobile'.
            terminal_uuid: { type: DataTypes.STRING, allowNull: true },
            tid: { type: DataTypes.STRING, allowNull: true },
            client: { type: DataTypes.STRING(20), allowNull: true },

            // Poruka greške koju je uređaj dobio (status >= 400 ili prekid).
            error_msg: { type: DataTypes.STRING(1000), allowNull: true },
            // Broj zapisa po popisu u odgovoru ("lines: 7 · harbors: 20").
            response_summary: { type: DataTypes.STRING(1000), allowNull: true },

            // Sadržaj zahtjeva i odgovora (JSON kao tekst), tajne maskirane, dugi
            // popisi skraćeni, rez na 20 000 znakova.
            request_body: { type: DataTypes.TEXT, allowNull: true },
            response_body: { type: DataTypes.TEXT, allowNull: true },
        },
        {
            freezeTableName: true,
            tableName: "terminal_logs",
            timestamps: true,
            indexes: [
                { fields: ["createdAt"] },
                { fields: ["tid", "createdAt"] },
                { fields: ["status_code"] },
            ],
        },
    );
    return { TerminalLogsModel };
};
