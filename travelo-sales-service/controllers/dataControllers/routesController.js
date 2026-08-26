const { Op } = require("sequelize");
const { getSequelize } = require("../../config/database");

const getRoutesDataController = async (req, res) => {
    const sequelize = getSequelize();
    const { RoutesModel } = req.app.locals.models;
    try {
        const result = await sequelize.transaction(async (t) => {
            // Ovo je izvor polazaka za blagajne (desk i mobilna preko
            // transport_data). Ni jedna ni druga ne filtriraju rute same, pa se
            // otkazani polazak filtrira ovdje — inače ostaje u prodaji na
            // blagajni iako je dispečer otkazao putovanje.
            const routesData = await RoutesModel.findAll({
                where: {
                    is_active: true,
                    [Op.or]: [
                        { sale_status: { [Op.ne]: "CANCELED" } },
                        { sale_status: { [Op.is]: null } },
                    ],
                },
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

// PATCH /routes/cancel_batch — body: { route_uuids: [], canceled: true|false }
//
// Ovo je kopija ruta za blagajne; matični zapis je u boat-serviceu i ondje se
// otkaz upisuje prvi. Ovdje se isti upis ponavlja da otkaz vrijedi odmah, bez
// čekanja na sinkronizaciju voznog reda.
//
// Uz sale_status gasi se i is_active jer terminali polaske filtriraju po njemu
// (mobilna: LineSelectScreen). Sam sale_status nitko na blagajni ne gleda, pa
// je otkazani polazak dosad ostajao u prodaji.
const cancelRoutesBatchController = async (req, res) => {
    const { RoutesModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const uuids = Array.isArray(data.route_uuids) ? data.route_uuids : [];
        const otkazan = data.canceled !== false;
        if (!uuids.length) {
            return res.send({ status: 400, data: { message: "route_uuids required" } });
        }
        const [affected] = await RoutesModel.update(
            otkazan
                ? { sale_status: "CANCELED", is_active: false }
                : { sale_status: null, is_active: true },
            { where: { uuid: { [Op.in]: uuids } } }
        );
        res.send({ status: 200, data: { affected, canceled: otkazan } });
    } catch (error) {
        console.log("cancelRoutesBatchController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

module.exports = {
    getRoutesDataController,
    cancelRoutesBatchController,
};
