const Sequelize = require('sequelize');
const { sequelize } = require("../index.cjs")

// Evidencija ispisanih kopija karata na ovoj blagajni.
//
// Redni broj kopije se određuje ovdje, iz onoga što je blagajna sama ispisala:
// kopija mora izaći i kad veze nema, a račun oznake (redni broj + marker iz
// uuid-a karte) ne treba poslužitelja.
//
// Ista karta može dobiti kopiju i na drugom mjestu — mobilnoj blagajni, portalu
// — pa se brojevi znaju poklopiti. U kontroli se to vidi kao dvije kopije istog
// rednog broja i samo po sebi je podatak; ispis koji čeka mrežu bio bi gori.
const ticketCopyPrintsModel = sequelize.define('ticket_copy_prints', {
    id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ticket_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    ticket_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    copy_no:{
        type: Sequelize.INTEGER,
        allowNull: false
    },
    // Tri znaka koja su otisnuta na papiru. Iznad dvadeset i četvrte kopije
    // redni broj ne stane u dva znaka, pa ostaje prazno — ispis se svejedno
    // bilježi, samo mu oznaka ne nosi broj.
    suffix:{
        type: Sequelize.STRING,
        allowNull: true
    },
    printed_at:{
        type: Sequelize.DATE,
        allowNull: false
    },
    operator_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    billing_device_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    billing_device_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    business_premise_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    // Dok je false, zapis čeka u redu za poslužitelja.
    synced:{
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
})

module.exports = { ticketCopyPrintsModel }
