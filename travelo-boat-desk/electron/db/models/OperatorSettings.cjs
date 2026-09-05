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
    // Luka s koje blagajnik najčešće prodaje. Kad odabere liniju, polazna luka
    // se postavi na nju umjesto da ostane prazna — na jednoj se blagajni gotovo
    // uvijek prodaje s iste luke, pa je to bio klik koji se ponavljao cijeli dan.
    // Čuva se kod luke (harbor.code), ne uuid, jer se plovidbeni red i rute
    // vežu po kodu.
    home_harbor_code: {
        type: Sequelize.STRING,
        allowNull: true
    },
}, {
    freezeTableName: true
})

module.exports = { operatorSettingsModel }
