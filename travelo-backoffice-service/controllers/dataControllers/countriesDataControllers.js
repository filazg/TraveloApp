const getCountriesDataController = async (req, res) => {
    const { CountriesModel } = req.app.locals.models;
    try {
        const onlyActive = req.query.only_active === "true" || req.query.only_active === "1";
        const where = onlyActive ? { is_active: true } : {};
        const countries = await CountriesModel.findAll({
            where,
            attributes: { exclude: ["createdAt", "updatedAt"] },
            order: [["name_hr", "ASC"]],
        });
        res.send({ status: 200, data: { countries } });
    } catch (error) {
        console.log("getCountriesDataController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { error: error.message } });
    }
};

const addCountryDataController = async (req, res) => {
    const { CountriesModel } = req.app.locals.models;
    try {
        const data = req.body.body || req.body || {};
        if (!data.code || !data.name_hr || !data.name_en) {
            return res.status(400).send({ status: 400, data: { message: "code, name_hr, name_en required" } });
        }
        const code = String(data.code).toUpperCase().trim();
        if (code.length !== 2) {
            return res.status(400).send({ status: 400, data: { message: "code must be 2 letters" } });
        }
        const existing = await CountriesModel.findOne({ where: { code } });
        if (existing) {
            return res.status(208).send({ status: 208, data: { message: "country already exists" } });
        }
        await CountriesModel.create({
            code,
            name_hr: data.name_hr,
            name_en: data.name_en,
            is_active: data.is_active ?? true,
        });
        res.send({ status: 201 });
    } catch (error) {
        console.log("addCountryDataController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { error: error.message } });
    }
};

const updateCountryDataController = async (req, res) => {
    const { CountriesModel } = req.app.locals.models;
    try {
        const data = req.body.body || req.body || {};
        if (!data.code) {
            return res.status(400).send({ status: 400, data: { message: "code required" } });
        }
        const code = String(data.code).toUpperCase().trim();
        const existing = await CountriesModel.findOne({ where: { code } });
        if (!existing) {
            return res.status(404).send({ status: 404, data: { message: "country not found" } });
        }
        await CountriesModel.update(
            {
                name_hr: data.name_hr ?? existing.name_hr,
                name_en: data.name_en ?? existing.name_en,
                is_active: data.is_active ?? existing.is_active,
            },
            { where: { code } }
        );
        res.send({ status: 200 });
    } catch (error) {
        console.log("updateCountryDataController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { error: error.message } });
    }
};

module.exports = {
    getCountriesDataController,
    addCountryDataController,
    updateCountryDataController,
};
