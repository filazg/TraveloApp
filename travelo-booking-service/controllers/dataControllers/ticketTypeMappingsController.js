const crypto = require("crypto");

const getMappingsController = async (req, res) => {
    const { TicketTypeMappingModel } = req.app.locals.models;
    try {
        const where = {};
        if (req.query.ticket_type_uuid) where.ticket_type_uuid = req.query.ticket_type_uuid;
        const rows = await TicketTypeMappingModel.findAll({
            where,
            attributes: { exclude: ["createdAt", "updatedAt"] },
            order: [["id", "ASC"]],
        });
        res.send({ status: 200, data: { mappings: rows } });
    } catch (error) {
        console.log("getMappingsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { error: error.message } });
    }
};

const addMappingController = async (req, res) => {
    const { TicketTypeMappingModel, CapacityCategoryModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        if (!data.ticket_type_uuid || !data.category_uuid) {
            return res.status(400).send({ status: 400, data: { message: "ticket_type_uuid and category_uuid required" } });
        }
        const category = await CapacityCategoryModel.findOne({ where: { uuid: data.category_uuid } });
        if (!category) return res.status(400).send({ status: 400, data: { message: "category not found" } });

        const existing = await TicketTypeMappingModel.findOne({
            where: { ticket_type_uuid: data.ticket_type_uuid },
        });
        if (existing) {
            await TicketTypeMappingModel.update(
                {
                    ticket_type_name: data.ticket_type_name ?? existing.ticket_type_name,
                    category_uuid: data.category_uuid,
                    category_code: category.code,
                    is_active: data.is_active ?? true,
                },
                { where: { ticket_type_uuid: data.ticket_type_uuid } }
            );
            return res.send({ status: 200 });
        }
        await TicketTypeMappingModel.create({
            uuid: crypto.randomUUID(),
            ticket_type_uuid: data.ticket_type_uuid,
            ticket_type_name: data.ticket_type_name || null,
            category_uuid: data.category_uuid,
            category_code: category.code,
            is_active: data.is_active ?? true,
        });
        res.send({ status: 201 });
    } catch (error) {
        console.log("addMappingController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { error: error.message } });
    }
};

const updateMappingController = async (req, res) => {
    const { TicketTypeMappingModel, CapacityCategoryModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        if (!data.uuid) return res.status(400).send({ status: 400, data: { message: "uuid required" } });
        const existing = await TicketTypeMappingModel.findOne({ where: { uuid: data.uuid } });
        if (!existing) return res.status(404).send({ status: 404, data: { message: "mapping not found" } });
        let category_code = existing.category_code;
        if (data.category_uuid && data.category_uuid !== existing.category_uuid) {
            const cat = await CapacityCategoryModel.findOne({ where: { uuid: data.category_uuid } });
            if (cat) category_code = cat.code;
        }
        await TicketTypeMappingModel.update(
            {
                ticket_type_name: data.ticket_type_name ?? existing.ticket_type_name,
                category_uuid: data.category_uuid ?? existing.category_uuid,
                category_code,
                is_active: data.is_active ?? existing.is_active,
            },
            { where: { uuid: data.uuid } }
        );
        res.send({ status: 200 });
    } catch (error) {
        console.log("updateMappingController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { error: error.message } });
    }
};

module.exports = {
    getMappingsController,
    addMappingController,
    updateMappingController,
};
