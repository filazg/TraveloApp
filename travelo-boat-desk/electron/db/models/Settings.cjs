const Sequelize = require('sequelize');
const { sequelize } = require("../index.cjs")

// Predefinirane vrijednosti za svježu instalaciju — blagajnik na terenu tada
// ne mora ništa upisivati osim onoga što se stvarno razlikuje od postavke do
// postavke. Vrijede samo za novi zapis; postojeće instalacije zadržavaju svoje.
const DEFAULTS = {
    backend_url: 'https://bookingtest.krilo.hr/app',
    printer_location: '//localhost/BIXOLON',
    printer_ticket_location: '//localhost/BIXOLON',
    printer_width: '42',
    card_reader: 'ACS ACR1252 1S CL Reader PICC 0',
    pos_port: 'COM6',
    printer_cut: true,
};

const systemSettingsDataModel = sequelize.define('system_settings',{
    id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    backend_url:{
        type: Sequelize.STRING,
        allowNull:true,
        defaultValue: DEFAULTS.backend_url
    },
    printer_location:{
        type: Sequelize.STRING,
        allowNull:true,
        defaultValue: DEFAULTS.printer_location
    },
    printer_width:{
        type: Sequelize.STRING,
        allowNull:true,
        defaultValue: DEFAULTS.printer_width
    },
    printer_ticket_location:{
        type: Sequelize.STRING,
        allowNull:true,
        defaultValue: DEFAULTS.printer_ticket_location
    },
    card_reader:{
        type: Sequelize.STRING,
        allowNull:true,
        defaultValue: DEFAULTS.card_reader
    },
    pos_port:{
        type: Sequelize.STRING,
        allowNull:true,
        defaultValue: DEFAULTS.pos_port
    },
    auto_validate:{
        type: Sequelize.BOOLEAN,
        allowNull:true
    },
    pos_print_on_app:{
        type: Sequelize.BOOLEAN,
        allowNull:true
    },
    pos_print_additional_slip:{
        type: Sequelize.BOOLEAN,
        allowNull:true
    },
    // Rez papira na printeru. Isključi kad je cutter u kvaru — tada se umjesto
    // reza izvuče višak papira da se ispis ima gdje potrgati rukom.
    printer_cut:{
        type: Sequelize.BOOLEAN,
        allowNull:true,
        defaultValue: DEFAULTS.printer_cut
    },
    // Početak numeracije pri preseljenju blagajne na drugo računalo. Brojevi se
    // inače izvode iz MAX-a u lokalnoj tablici računa, a ta je na novom
    // računalu prazna — numeracija bi krenula od 1 i ponovila već izdane
    // fiskalne brojeve.
    //
    // Ponašaju se kao DONJA GRANICA, ne kao tvrda vrijednost: čim lokalni
    // računi prijeđu tu brojku, granica više nema učinka i ne može uzrokovati
    // duplikat.
    //
    // next_invoice_year veže granicu uz godinu u kojoj je postavljena.
    // Numeracija se resetira svake godine, pa bi granica bez toga sljedeće
    // godine spriječila povratak na 1.
    next_invoice_no:{
        type: Sequelize.INTEGER,
        allowNull:true
    },
    next_invoice_fiskal_no:{
        type: Sequelize.INTEGER,
        allowNull:true
    },
    next_invoice_year:{
        type: Sequelize.INTEGER,
        allowNull:true
    },
},{
    freezeTableName:true
})

module.exports={
    systemSettingsDataModel,
    DEFAULTS
}