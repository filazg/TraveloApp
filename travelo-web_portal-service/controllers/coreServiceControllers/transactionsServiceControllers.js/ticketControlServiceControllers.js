const axios = require('axios');
const { getCoreServiceConfigData } = require('../../configServices/configSyncController');

// Modul KONTROLA — podaci o kopijama karata i validacijama.
//
// Sve troje je čitanje iz transactions servisa. Praznina se vraća kao prazan
// popis, ne kao greška: portal tada pokaže prazan pregled umjesto da padne, a
// razlog stoji u logu.

// Karte kod kojih je uhvaćen sukob original ↔ kopija, jedan redak po karti.
const getTicketCopyConflictsController = async (params = {}) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.get(
            coreConfigData.services.transactions.url + '/ticket_copy_conflicts',
            { params }
        );
        return response.data?.data || { conflicts: [] };
    } catch (error) {
        console.log('getTicketCopyConflictsController error:', error?.message || error);
        return { conflicts: [] };
    }
};

// Pojedinačni pokušaji validacije. Bez filtra vraća zadnje po vremenu; s
// ticket_uuid cijelu povijest jedne karte, što je pogled iz detalja sukoba.
const getTicketValidationsController = async (params = {}) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.get(
            coreConfigData.services.transactions.url + '/ticket_validations',
            { params }
        );
        return response.data?.data || { validations: [] };
    } catch (error) {
        console.log('getTicketValidationsController error:', error?.message || error);
        return { validations: [] };
    }
};

// Evidentirani ispisi kopija — tko je i kada izdao koju kopiju.
const getTicketCopyPrintsController = async (params = {}) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.get(
            coreConfigData.services.transactions.url + '/ticket_copy_prints',
            { params }
        );
        return response.data?.data || { copies: [] };
    } catch (error) {
        console.log('getTicketCopyPrintsController error:', error?.message || error);
        return { copies: [] };
    }
};

module.exports = {
    getTicketCopyConflictsController,
    getTicketValidationsController,
    getTicketCopyPrintsController,
};
