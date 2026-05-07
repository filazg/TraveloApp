const axios = require('axios');
const { getCoreServiceConfigData } = require('../../configServices/configSyncController');

const boUrl = () => getCoreServiceConfigData()?.services?.backoffice?.url;

const getAccountsController = async () => {
    const r = await axios.get(boUrl() + '/accounts');
    return r.data;
};
const addAccountController = async (data) => {
    const r = await axios.post(boUrl() + '/accounts', data);
    return r.data;
};
const updateAccountController = async (data) => {
    const r = await axios.patch(boUrl() + '/accounts', data);
    return r.data;
};

const getAccountMappingsController = async () => {
    const r = await axios.get(boUrl() + '/account_mappings');
    return r.data;
};
const upsertAccountMappingController = async (data) => {
    const r = await axios.post(boUrl() + '/account_mappings', data);
    return r.data;
};

module.exports = {
    getAccountsController,
    addAccountController,
    updateAccountController,
    getAccountMappingsController,
    upsertAccountMappingController,
};
