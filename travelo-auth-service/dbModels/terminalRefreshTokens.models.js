const { DataTypes } = require("sequelize");

// Server-side store refresh tokena po terminalu. Opoziv (revoked) + klizni
// istek (expires_at se pomiče pri svakoj rotaciji). Jedan aktivan zapis po
// terminalu — pri prijavi/uparivanju i pri refreshu se rotira (stari se briše/
// zamjenjuje), pa je i detekcija ponovne upotrebe starog tokena moguća.
module.exports = (sequelize) => {
    const TerminalRefreshTokensModel = sequelize.define(
        "terminal_refresh_tokens",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            terminal_uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            // Neprozirni slučajni token (nije JWT) — provjera je DB lookup.
            refresh_token: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            revoked: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
        },
        { freezeTableName: true, tableName: "terminal_refresh_tokens", timestamps: true },
    );
    return { TerminalRefreshTokensModel };
};
