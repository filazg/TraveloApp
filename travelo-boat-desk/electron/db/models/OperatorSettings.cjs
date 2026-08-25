const Sequelize = require('sequelize');
const { sequelize } = require("../index.cjs")

// Osobne postavke operatera. Odvojene od system_settings: one su postavke
// instalacije (printer, backend, numeracija) i zaključane su kodom, a ove su
// stvar navike pojedinog blagajnika i mijenja ih sam.
//
// Vezane su uz operater_username, ne uz uređaj — na blagajni se izmjenjuje više
// operatera i svaki ima svoje prečace.
const operatorSettingsModel = sequelize.define('operator_settings', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    operater_username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
    },
    // { "F1": "payment:<uuid>", "F2": "invoices", ... } — prazno znači da tipka
    // nije dodijeljena. JSON jer je popis tipki fiksan, a skup radnji raste.
    shortcuts: {
        type: Sequelize.JSON,
        allowNull: true
    },
}, {
    freezeTableName: true
})

module.exports = { operatorSettingsModel }
