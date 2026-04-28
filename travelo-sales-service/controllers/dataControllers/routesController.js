const { Op } = require("sequelize");
const { getSequelize } = require("../../config/database");

const getRoutesDataController = async (req, res) => {
    const sequelize = getSequelize();
    const { RoutesModel } = req.app.locals.models;
    try {
        const result = await sequelize.transaction(async (t) => {
            const routesData = await RoutesModel.findAll({
                attributes: { exclude: ["createdAt", "updatedAt"] },
                order: [["id", "ASC"]],
            });
            res.send({ status: 200, data: { routes: routesData } });
        });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error } });
    }
};

// PATCH /routes/cancel_batch — body: { route_uuids: [] }
// Marks all matching routes as sale_status='CANCELED'. Returns affected count.
const cancelRoutesBatchController = async (req, res) => {
    const { RoutesModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const uuids = Array.isArray(data.route_uuids) ? data.route_uuids : [];
        if (!uuids.length) {
            return res.send({ status: 400, data: { message: "route_uuids required" } });
        }
        const [affected] = await RoutesModel.update(
            { sale_status: "CANCELED" },
            { where: { uuid: { [Op.in]: uuids } } }
        );
        res.send({ status: 200, data: { affected } });
    } catch (error) {
        console.log("cancelRoutesBatchController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

module.exports = {
    getRoutesDataController,
    cancelRoutesBatchController,
};
