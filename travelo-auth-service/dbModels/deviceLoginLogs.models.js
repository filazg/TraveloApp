const { DataTypes } = require("sequelize");

// Log SVAKOG javljanja uređaja (heartbeat na /login/terminalReport) — jedan
// redak po događaju (append, NIJE upsert). Uz TID/klijent/verziju bilježi se i
// `username` kad je poznat (prijava, zatvaranje smjene); startup javljanje nema
// korisnika pa je username NULL. Za razliku od `device_connections` (zadnje
// stanje po TID-u), ovo je povijest — vidi se tko se, s kojom verzijom i kad
// spajao. Admin kartica "Uređaji i verzije" prikazuje ovaj log.
module.exports = (sequelize) => {
    const DeviceLoginLogsModel = sequelize.define(
        "device_login_logs",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            tid: { type: DataTypes.STRING, allowNull: true },
            terminal_uuid: { type: DataTypes.STRING, allowNull: true },
            // 'desk' | 'mobile'
            client: { type: DataTypes.STRING, allowNull: true },
            app_version: { type: DataTypes.STRING, allowNull: true },
            // Korisnik koji je pokrenuo javljanje (prijava/zatvaranje smjene); NULL
            // za startup heartbeat (tada još nitko nije prijavljen).
            username: { type: DataTypes.STRING, allowNull: true },
            ip_address: { type: DataTypes.STRING, allowNull: true },
        },
        { freezeTableName: true, tableName: "device_login_logs", timestamps: true },
    );
    return { DeviceLoginLogsModel };
};
