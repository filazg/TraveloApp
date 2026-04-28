const crypto = require("crypto");

const getCategoriesController = async (req, res) => {
    const { CapacityCategoryModel } = req.app.locals.models;
    try {
        const onlyActive = req.query.only_active === "true" || req.query.only_active === "1";
        const where = onlyActive ? { is_active: true } : {};
        const rows = await CapacityCategoryModel.findAll({
            where,
            attributes: { exclude: ["createdAt", "updatedAt"] },
            order: [["id", "ASC"]],
        });
        res.send({ status: 200, data: { categories: rows } });
    } catch (error) {
        console.log("getCategoriesController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { error: error.message } });
    }
};

const addCategoryController = async (req, res) => {
    const { CapacityCategoryModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        if (!data.code || !data.name_hr || !data.name_en) {
            return res.status(400).send({ status: 400, data: { message: "code, name_hr, name_en required" } });
        }
        const existing = await CapacityCategoryModel.findOne({ where: { code: data.code } });
        if (existing) return res.status(208).send({ status: 208, data: { message: "category already exists" } });
        await CapacityCategoryModel.create({
            uuid: crypto.randomUUID(),
            code: String(data.code).toUpperCase().trim(),
            name_hr: data.name_hr,
            name_en: data.name_en,
            is_active: data.is_active ?? true,
        });
        res.send({ status: 201 });
    } catch (error) {
        console.log("addCategoryController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { error: error.message } });
    }
};

const updateCategoryController = async (req, res) => {
    const { CapacityCategoryModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        if (!data.uuid) return res.status(400).send({ status: 400, data: { message: "uuid required" } });
        const existing = await CapacityCategoryModel.findOne({ where: { uuid: data.uuid } });
        if (!existing) return res.status(404).send({ status: 404, data: { message: "category not found" } });
        await CapacityCategoryModel.update(
            {
                name_hr: data.name_hr ?? existing.name_hr,
                name_en: data.name_en ?? existing.name_en,
                is_active: data.is_active ?? existing.is_active,
            },
            { where: { uuid: data.uuid } }
        );
        res.send({ status: 200 });
    } catch (error) {
        console.log("updateCategoryController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { error: error.message } });
    }
};

module.exports = {
    getCategoriesController,
    addCategoryController,
    updateCategoryController,
};
