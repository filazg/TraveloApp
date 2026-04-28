const { getSequelize } = require("../../config/database");

const getDeparturesController = async (req, res) => {
    const sequelize = getSequelize();
    const { DeparturesModel } = req.app.locals.models;
    try {
        await sequelize.transaction(async (t) => {
            const where = {};
            if (req.query.timetable_uuid) where.timetable_uuid = req.query.timetable_uuid;
            if (req.query.departure_date) where.departure_date = req.query.departure_date;
            const rows = await DeparturesModel.findAll({
                where,
                attributes: { exclude: ["createdAt", "updatedAt"] },
                order: [["id", "ASC"]],
            });
            res.send({ status: 200, data: { departures: rows } });
        });
    } catch (error) {
        console.log("getDeparturesController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

const getDepartureByUuidController = async (req, res) => {
    const { DeparturesModel } = req.app.locals.models;
    try {
        const row = await DeparturesModel.findOne({
            where: { uuid: req.params.uuid },
            attributes: { exclude: ["createdAt", "updatedAt"] },
        });
        if (!row) return res.status(404).send({ status: 404, data: { message: "departure not found" } });
        res.send({ status: 200, data: { departure: row } });
    } catch (error) {
        console.log("getDepartureByUuidController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { error: error.message } });
    }
};

const getRoutesByDepartureController = async (req, res) => {
    const { RoutesModel } = req.app.locals.models;
    try {
        const rows = await RoutesModel.findAll({
            where: { departure_uuid: req.params.uuid },
            attributes: { exclude: ["createdAt", "updatedAt"] },
            order: [["departure_harbor_order", "ASC"]],
        });
        res.send({ status: 200, data: { routes: rows } });
    } catch (error) {
        console.log("getRoutesByDepartureController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { error: error.message } });
    }
};

const getRouteByUuidController = async (req, res) => {
    const { RoutesModel } = req.app.locals.models;
    try {
        const row = await RoutesModel.findOne({
            where: { uuid: req.params.uuid },
            attributes: { exclude: ["createdAt", "updatedAt"] },
        });
        if (!row) return res.status(404).send({ status: 404, data: { message: "route not found" } });
        res.send({ status: 200, data: { route: row } });
    } catch (error) {
        console.log("getRouteByUuidController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { error: error.message } });
    }
};

module.exports = {
    getDeparturesController,
    getDepartureByUuidController,
    getRoutesByDepartureController,
    getRouteByUuidController,
};
