const crypto = require("crypto");
const { getSequelize } = require("../../config/database")

const sequelize = getSequelize();

// Šifarnik postotaka storniranja. Terminali ga preuzimaju sinkom i nude
// blagajniku kao izbor pri povratu karte, umjesto slobodnog upisa.
// Za razliku od ostalih šifarnika, ovaj svjesno vraća i neaktivne kad se traži
// s ?all=1 — administracija ih mora vidjeti da bi ih mogla vratiti u upotrebu.
const getStornoPercentagesDataController = async (req, res) => {
    const { StornoPercentagesModel } = req.app.locals.models;
    try {
        const where = String(req.query.all) === "1" ? {} : { is_active: true };
        const rows = await StornoPercentagesModel.findAll({
            where,
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            order: [['percentage', 'DESC']]
        });
        res.send({
            status: 200,
            data: {
                storno_percentages: rows
            }
        });
    } catch (error) {
        console.log("getStornoPercentagesDataController error:", error?.message || error);
        res.send({ status: 500, data: { error: error?.message || String(error) } });
    }
}

const addStornoPercentageDataController = async (req, res) => {
    const { StornoPercentagesModel } = req.app.locals.models;
    try {
        const data = req.body.body || req.body || {};
        const percentage = Number(data.percentage);
        if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
            return res.send({ status: 400, data: { message: "Postotak mora biti broj između 0 i 100." } });
        }
        await sequelize.transaction(async () => {
            // Isti postotak dvaput bi blagajniku dao dva jednaka gumba.
            const exists = await StornoPercentagesModel.findOne({ where: { percentage } });
            if (exists) {
                return res.send({ status: 409, data: { message: "Taj postotak već postoji." } });
            }
            await StornoPercentagesModel.create({
                uuid: crypto.randomUUID(),
                percentage,
                name: data.name || null,
                is_active: true
            });
            res.send({ status: 201 });
        });
    } catch (error) {
        console.log("addStornoPercentageDataController error:", error?.message || error);
        res.send({ status: 500, data: { error: error?.message || String(error) } });
    }
}

const updateStornoPercentageDataController = async (req, res) => {
    const { StornoPercentagesModel } = req.app.locals.models;
    try {
        const data = req.body.body || req.body || {};
        await sequelize.transaction(async () => {
            const row = await StornoPercentagesModel.findOne({ where: { uuid: data.uuid } });
            if (!row) {
                return res.send({ status: 404, data: { message: "Postotak nije pronađen." } });
            }
            const patch = {};
            if (data.is_active !== undefined) patch.is_active = data.is_active;
            if (data.name !== undefined) patch.name = data.name || null;
            if (data.percentage !== undefined) {
                const percentage = Number(data.percentage);
                if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
                    return res.send({ status: 400, data: { message: "Postotak mora biti broj između 0 i 100." } });
                }
                patch.percentage = percentage;
            }
            await StornoPercentagesModel.update(patch, { where: { uuid: data.uuid } });
            res.send({ status: 201 });
        });
    } catch (error) {
        console.log("updateStornoPercentageDataController error:", error?.message || error);
        res.send({ status: 500, data: { error: error?.message || String(error) } });
    }
}

module.exports = {
    getStornoPercentagesDataController,
    addStornoPercentageDataController,
    updateStornoPercentageDataController
}
