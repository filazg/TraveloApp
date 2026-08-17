const { DataTypes } = require("sequelize");

// Postavke izdavanja računa po prodajnom kanalu — jedan redak po kanalu.
// Web prodaja je dosad kontekst pogađala ("jedini aktivni WEB_OFFICE prostor i
// njegov jedini aktivni uređaj"), a partnerski računi nisu imali ni prostor ni
// uređaj. Ovdje se to postavlja eksplicitno, izvan općih ekrana za prodajna
// mjesta i naplatne uređaje.
//
// Provizija, stopa PDV-a i dinamika izdavanja NISU ovdje — one ostaju po
// partneru (partners.commission_pct / vat_rate / f2_required).
module.exports = (sequelize) => {
    const ChannelSettingsModel = sequelize.define(
        "channel_settings",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            // "web" | "partner"
            channel: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            business_premise_uuid: {
                type: DataTypes.STRING,
                allowNull: true
            },
            business_premise_name: {
                type: DataTypes.STRING,
                allowNull: true
            },
            business_premise_fiscal_mark: {
                type: DataTypes.STRING,
                allowNull: true
            },
            billing_device_uuid: {
                type: DataTypes.STRING,
                allowNull: true
            },
            billing_device_fiscal_mark: {
                type: DataTypes.STRING,
                allowNull: true
            },
            payment_method_uuid: {
                type: DataTypes.STRING,
                allowNull: true
            },
            payment_method_name: {
                type: DataTypes.STRING,
                allowNull: true
            },
            fiskal_required: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            // Zadani jezik računa kad ga kupac ne odabere: "hr" | "en".
            invoice_language: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: "hr"
            },
            invoice_header: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            invoice_footer: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            // Šifra mjesta troška za zaključak prometa i temeljnicu. Ako je
            // prazna, izvještaj je i dalje vuče s naplatnog uređaja.
            cost_center: {
                type: DataTypes.STRING,
                allowNull: true
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
        },
        { freezeTableName: true, tableName: "channel_settings", timestamps: true }
    );

    return {
        ChannelSettingsModel
    };
};
