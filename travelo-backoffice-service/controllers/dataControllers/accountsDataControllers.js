const { getSequelize } = require("../../config/database");

const sequelize = getSequelize();

const getAccountsDataController = async (req, res) => {
    const { AccountsModel } = req.app.locals.models;
    try {
        const rows = await AccountsModel.findAll({
            attributes: { exclude: ["createdAt", "updatedAt"] },
            order: [["code", "ASC"]],
        });
        res.send({ status: 200, data: { accounts: rows } });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

const addAccountDataController = async (req, res) => {
    const { AccountsModel } = req.app.locals.models;
    try {
        const data = req.body.body || req.body;
        await sequelize.transaction(async () => {
            await AccountsModel.create({
                uuid: crypto.randomUUID(),
                code: data.code,
                name: data.name,
                description: data.description || null,
                is_active: data.is_active ?? true,
            });
        });
        res.send({ status: 201 });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

const updateAccountDataController = async (req, res) => {
    const { AccountsModel } = req.app.locals.models;
    try {
        const data = req.body.body || req.body;
        await AccountsModel.update(
            {
                code: data.code,
                name: data.name,
                description: data.description || null,
                is_active: data.is_active,
            },
            { where: { uuid: data.uuid } },
        );
        res.send({ status: 201 });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

const getAccountMappingsDataController = async (req, res) => {
    const { AccountMappingsModel } = req.app.locals.models;
    try {
        const rows = await AccountMappingsModel.findAll({
            attributes: { exclude: ["createdAt", "updatedAt"] },
            order: [["mapping_key", "ASC"]],
        });
        res.send({ status: 200, data: { account_mappings: rows } });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

// Upsert by mapping_key — UI mijenja postojeći mapping ili kreira novi.
const upsertAccountMappingDataController = async (req, res) => {
    const { AccountMappingsModel } = req.app.locals.models;
    try {
        const data = req.body.body || req.body;
        if (!data.mapping_key || !data.account_uuid) {
            return res.send({ status: 400, data: { error: "mapping_key and account_uuid required" } });
        }
        const existing = await AccountMappingsModel.findOne({
            where: { mapping_key: data.mapping_key },
        });
        if (existing) {
            await AccountMappingsModel.update(
                {
                    account_uuid: data.account_uuid,
                    direction: data.direction || "credit",
                    note: data.note || null,
                },
                { where: { mapping_key: data.mapping_key } },
            );
        } else {
            await AccountMappingsModel.create({
                uuid: crypto.randomUUID(),
                mapping_key: data.mapping_key,
                account_uuid: data.account_uuid,
                direction: data.direction || "credit",
                note: data.note || null,
            });
        }
        res.send({ status: 201 });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

module.exports = {
    getAccountsDataController,
    addAccountDataController,
    updateAccountDataController,
    getAccountMappingsDataController,
    upsertAccountMappingDataController,
};
