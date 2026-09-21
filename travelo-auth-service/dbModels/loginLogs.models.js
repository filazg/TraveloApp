const { DataTypes } = require("sequelize");

// Log prijava portal korisnika (sistemski useri, npr. nfilipec). Bilježe se i
// uspješne i neuspjele prijave (krivi user / kriva lozinka) — za sigurnost i
// dijagnostiku. Piše ga webPortalLoginController; čita ga administracija u
// portalu preko web_portal-service (BFF).
module.exports = (sequelize) => {
    const LoginLogsModel = sequelize.define(
        "login_logs",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            username: { type: DataTypes.STRING, allowNull: false },
            success: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
            // Zašto (ne)uspjeh: 'ok' | 'bad_user' | 'bad_password'. Ne sprema se
            // lozinka ni njezin hash.
            reason: { type: DataTypes.STRING, allowNull: true },
            ip_address: { type: DataTypes.STRING, allowNull: true },
        },
        // timestamps: createdAt je vrijeme prijave.
        { freezeTableName: true, tableName: "login_logs", timestamps: true },
    );
    return { LoginLogsModel };
};
