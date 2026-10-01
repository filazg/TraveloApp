const { DataTypes } = require("sequelize");

// Log spajanja partnera preko API-ja (T4B API, channel-api servis) — Sistem →
// „API partneri". Jedan redak po zahtjevu, uspješnom i neuspjelom (krivi
// token, kriva kontrolna oznaka, rate limit, greška). Piše ga channel-api
// (nema svoju bazu), čita portal preko web_portal-service (BFF).
//
// Ne sprema se ništa tajno: ni otp, ni token, ni ključ (k), ni control_code.
module.exports = (sequelize) => {
    const PartnerApiLogsModel = sequelize.define(
        "partner_api_logs",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            method: { type: DataTypes.STRING(10), allowNull: true },
            path: { type: DataTypes.STRING, allowNull: true },
            status_code: { type: DataTypes.INTEGER, allowNull: true },
            ok: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
            duration_ms: { type: DataTypes.INTEGER, allowNull: true },
            ip_address: { type: DataTypes.STRING, allowNull: true },
            user_agent: { type: DataTypes.STRING(500), allowNull: true },

            // Tko je zvao. Kod neuspjele prijave poznat je samo TID iz zahtjeva,
            // kod isteklog tokena ono što piše u njemu.
            api_user_uuid: { type: DataTypes.STRING, allowNull: true },
            partner_uuid: { type: DataTypes.STRING, allowNull: true },
            partner_acr: { type: DataTypes.STRING, allowNull: true },
            partner_name: { type: DataTypes.STRING, allowNull: true },
            tid: { type: DataTypes.STRING, allowNull: true },

            // Poruka greške koju je partner dobio (status >= 400).
            error_msg: { type: DataTypes.STRING(1000), allowNull: true },
            // Narudžba na koju se zahtjev odnosi (order / confirm / cancel / details).
            order_number: { type: DataTypes.STRING, allowNull: true },

            // Sadržaj zahtjeva i odgovora (JSON kao tekst), s maskiranim tajnama
            // i odrezan na 20 000 znakova. Stupci su dodani naknadno —
            // migrate_partner_api_logs_bodies.js.
            request_body: { type: DataTypes.TEXT, allowNull: true },
            response_body: { type: DataTypes.TEXT, allowNull: true },
        },
        {
            freezeTableName: true,
            tableName: "partner_api_logs",
            timestamps: true,
            indexes: [
                { fields: ["createdAt"] },
                { fields: ["partner_uuid", "createdAt"] },
                { fields: ["status_code"] },
            ],
        },
    );
    return { PartnerApiLogsModel };
};
