const { DataTypes } = require("sequelize");

// Zadnje stanje po uređaju: jedan redak po TID-u, ažurira se (upsert) svaki put
// kad se uređaj javi pri pokretanju (heartbeat na /login/terminalReport). Bitno
// je vidjeti s kojom se VERZIJOM uređaj spaja i kad je zadnji put viđen.
module.exports = (sequelize) => {
    const DeviceConnectionsModel = sequelize.define(
        "device_connections",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            // Jedan redak po uređaju — TID je jedinstven.
            tid: { type: DataTypes.STRING, allowNull: false, unique: true },
            terminal_uuid: { type: DataTypes.STRING, allowNull: true },
            // 'desk' | 'mobile' — koji klijent se javio.
            client: { type: DataTypes.STRING, allowNull: true },
            app_version: { type: DataTypes.STRING, allowNull: true },
            ip_address: { type: DataTypes.STRING, allowNull: true },
            last_seen: { type: DataTypes.DATE, allowNull: true },
        },
        { freezeTableName: true, tableName: "device_connections", timestamps: true },
    );
    return { DeviceConnectionsModel };
};
