const { getSequelize } = require("../../config/database");
const { pomakni } = require("../../helpers/voyageTime");

const getRoutesDataController = async (req, res) => {
    const sequelize = getSequelize();
    const { RoutesModel } = req.app.locals.models;    
    try {
        const result = await sequelize.transaction(async (t)=>{
            const routesData = await RoutesModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            })
            res.send({
                status:200,
                data:{
                    routes:routesData
                }
            })
        })
    } catch (error) {
        console.log(error)
        res.send({
            status:500,
            data:{
                error
            }
        })
    }
}

// PATCH /routes/cancel_batch — body: { route_uuids: [], canceled: true|false }
//
// Web prodaja drži svoju kopiju ruta. Otkaz polaska dosad je nije dirao, pa se
// otkazani polazak i dalje mogao kupiti online. Matični zapis je u boat-serviceu;
// ovdje se isti upis ponavlja da otkaz vrijedi odmah.
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
            { where: { uuid: uuids } }
        );
        res.send({ status: 200, data: { affected, canceled: otkazan } });
    } catch (error) {
        console.log("cancelRoutesBatchController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};


// PATCH /routes/reschedule_batch — body: { route_uuids: [], delta_minutes }
//
// Pomak polaska. Planirano vrijeme ostaje netaknuto; aktualno se racuna kao
// planirano + razlika, pa je operacija idempotentna, a delta_minutes = 0 vraca
// polazak na vozni red. Razliku racuna boat-service (maticni podaci) i salje je
// ovamo, da isti racun ne postoji na tri mjesta.
const rescheduleRoutesBatchController = async (req, res) => {
    const { RoutesModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const uuids = Array.isArray(data.route_uuids) ? data.route_uuids : [];
        const delta = Number(data.delta_minutes) || 0;
        if (!uuids.length) {
            return res.send({ status: 400, data: { message: "route_uuids required" } });
        }
        const rute = await RoutesModel.findAll({ where: { uuid: uuids } });
        for (const r of rute) {
            await r.update({
                actual_departure: pomakni(r.departure, delta),
                actual_arrival: pomakni(r.arrival, delta),
            });
        }
        res.send({ status: 200, data: { affected: rute.length, delta_minutes: delta } });
    } catch (error) {
        console.log("rescheduleRoutesBatchController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

module.exports = {
    getRoutesDataController,
    cancelRoutesBatchController,
    rescheduleRoutesBatchController
}