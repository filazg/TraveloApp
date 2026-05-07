const { getSequelize } = require("../../config/database");
const seyforClient = require("../integrations/seyforClient");

const sequelize = getSequelize();

// Best-effort sync to Seyfor SAOP. Greška u SAOP pozivu ne ruši lokalni
// upis — samo zabilježimo `saop_last_error` da operator vidi da nije
// sinkronizirano i može ručno re-trigger-ati.
const pushToSaop = async (AddressbookModel, addr, { isUpdate }) => {
    try {
        if (!isUpdate) {
            // Pri kreiranju: prvo probaj match po OIB-u (link postojećeg
            // SAOP-customera umjesto duplikata), pa create ako nema.
            let saopCode = null;
            if (addr.buyer_vat_id) {
                try {
                    const existing = await seyforClient.findCustomerByOib(addr.buyer_vat_id);
                    if (existing?.Code) saopCode = existing.Code;
                } catch (e) {
                    console.log("seyfor findByOib error:", e.message);
                }
            }
            if (!saopCode) {
                const { code } = await seyforClient.addCustomer(addr);
                saopCode = code;
            }
            await AddressbookModel.update(
                {
                    saop_customer_code: saopCode || null,
                    saop_synced_at: saopCode ? new Date() : null,
                    saop_last_error: saopCode ? null : "no code returned",
                },
                { where: { uuid: addr.uuid } },
            );
        } else if (addr.saop_customer_code) {
            await seyforClient.updateCustomer(addr);
            await AddressbookModel.update(
                { saop_synced_at: new Date(), saop_last_error: null },
                { where: { uuid: addr.uuid } },
            );
        } else {
            // Update-amo lokalno postojećeg koji još nije u SAOP-u → create.
            const { code } = await seyforClient.addCustomer(addr);
            await AddressbookModel.update(
                {
                    saop_customer_code: code || null,
                    saop_synced_at: code ? new Date() : null,
                    saop_last_error: code ? null : "no code returned",
                },
                { where: { uuid: addr.uuid } },
            );
        }
    } catch (e) {
        console.log("seyfor sync error:", e.message);
        try {
            await AddressbookModel.update(
                { saop_last_error: String(e.message).slice(0, 250) },
                { where: { uuid: addr.uuid } },
            );
        } catch (_) {}
    }
};

const getAddressbookDataController = async (req, res) => {
    const { AddressbookModel } = req.app.locals.models;
    try {
        await sequelize.transaction(async () => {
            const addressbookData = await AddressbookModel.findAll({
                attributes: { exclude: ["createdAt", "updatedAt"] },
                order: [["id", "ASC"]],
            });
            res.send({ status: 200, data: { addressbook: addressbookData } });
        });
    } catch (error) {
        console.log(error);
    }
};

const addAddressbookDataController = async (req, res) => {
    const { AddressbookModel } = req.app.locals.models;
    try {
        const data = req.body.body;
        const created = await sequelize.transaction(async () => {
            return await AddressbookModel.create({
                uuid: crypto.randomUUID(16),
                buyer_name: data.buyer_name,
                buyer_company_name: data.buyer_company_name,
                buyer_legal_id: data.buyer_legal_id,
                buyer_vat_id: data.buyer_vat_id,
                buyer_address: data.buyer_address,
                buyer_town: data.buyer_town,
                buyer_postal_code: data.buyer_postal_code,
                buyer_country: data.buyer_country,
                buyer_email: data.buyer_email,
                f2_required: data.f2_required ?? false,
                buyer_is_active: true,
            });
        });
        // Out of transaction: SAOP push je best-effort, ne smije rušiti DB.
        pushToSaop(AddressbookModel, created.toJSON(), { isUpdate: false });
        res.send({ status: 201 });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error } });
    }
};

const updateAddressbookDataController = async (req, res) => {
    try {
        const { AddressbookModel } = req.app.locals.models;
        const data = req.body.body;
        const updated = await sequelize.transaction(async () => {
            const addressbookExist = await AddressbookModel.findOne({
                where: { uuid: data.uuid },
            });
            if (!addressbookExist) return null;
            await AddressbookModel.update(
                {
                    buyer_name: data.buyer_name,
                    buyer_company_name: data.buyer_company_name,
                    buyer_vat_id: data.buyer_vat_id,
                    buyer_address: data.buyer_address,
                    buyer_town: data.buyer_town,
                    buyer_postal_code: data.buyer_postal_code,
                    buyer_country: data.buyer_country,
                    buyer_email: data.buyer_email,
                    f2_required: data.f2_required ?? false,
                    buyer_is_active: data.buyer_is_active,
                },
                { where: { uuid: data.uuid } },
            );
            return await AddressbookModel.findOne({ where: { uuid: data.uuid } });
        });
        if (!updated) {
            return res.send({ status: 404, data: { msg: "Buyer not exist" } });
        }
        pushToSaop(AddressbookModel, updated.toJSON(), { isUpdate: true });
        res.send({ status: 201 });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error } });
    }
};

module.exports = {
    getAddressbookDataController,
    addAddressbookDataController,
    updateAddressbookDataController,
};
