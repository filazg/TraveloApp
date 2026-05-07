const {
    getAccountsController,
    addAccountController,
    updateAccountController,
    getAccountMappingsController,
    upsertAccountMappingController,
} = require('../../controllers/coreServiceControllers/backofficeServiceControllers.js/accountsServiceControllers');

const wrapAccounts = (rows) => ({
    status: 200,
    data: { path1: 'backofficeData', path2: 'accounts', data: rows },
});
const wrapMappings = (rows) => ({
    status: 200,
    data: { path1: 'backofficeData', path2: 'account_mappings', data: rows },
});

const refetchAccounts = async () => {
    const r = await getAccountsController();
    return r?.data?.accounts || [];
};
const refetchMappings = async () => {
    const r = await getAccountMappingsController();
    return r?.data?.account_mappings || [];
};

const handleGetAccountsFeature = async (req, res) => {
    try {
        res.send(wrapAccounts(await refetchAccounts()));
    } catch (e) {
        res.status(500).send({ status: 500, error: e.message });
    }
};
const handleAddAccountFeature = async (req, res) => {
    try {
        await addAccountController(req.body);
        res.send(wrapAccounts(await refetchAccounts()));
    } catch (e) {
        res.status(500).send({ status: 500, error: e.message });
    }
};
const handleUpdateAccountFeature = async (req, res) => {
    try {
        await updateAccountController(req.body);
        res.send(wrapAccounts(await refetchAccounts()));
    } catch (e) {
        res.status(500).send({ status: 500, error: e.message });
    }
};

const handleGetAccountMappingsFeature = async (req, res) => {
    try {
        res.send(wrapMappings(await refetchMappings()));
    } catch (e) {
        res.status(500).send({ status: 500, error: e.message });
    }
};
const handleUpsertAccountMappingFeature = async (req, res) => {
    try {
        await upsertAccountMappingController(req.body);
        res.send(wrapMappings(await refetchMappings()));
    } catch (e) {
        res.status(500).send({ status: 500, error: e.message });
    }
};

module.exports = {
    handleGetAccountsFeature,
    handleAddAccountFeature,
    handleUpdateAccountFeature,
    handleGetAccountMappingsFeature,
    handleUpsertAccountMappingFeature,
};
