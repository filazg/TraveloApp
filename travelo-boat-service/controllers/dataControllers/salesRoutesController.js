const { getSequelize } = require("../../config/database");
const { uMinute, pomakni } = require("../../helpers/voyageTime");
const { javiPromjenu } = require("../../helpers/syncSignal");



const getSalesRoutesController = async(req,res)=>{
    const sequelize = getSequelize();
    const {TimetablesModel, RoutesModel, TimetablePricesModel } = req.app.locals.models;
    try {
        console.log(req.body)
        const data = req.body.data;
        const timetableData = await TimetablesModel.findOne({
            where:{
                code:data
            },
            attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
        })
        let routesData = []
        let pricesData = []
        if(timetableData && timetableData.is_active){
            routesData = await RoutesModel.findAll({
                where:{
                    timetable_uuid:timetableData.uuid,
                    is_active:true
                },
                attributes: { exclude: ['createdAt','updatedAt'] },
                    order: [["id", "ASC"]],
            })
            pricesData = await TimetablePricesModel.findAll({
                where:{
                    timetable_uuid:timetableData.uuid,
                    is_active:true
                },
                attributes: { exclude: ['createdAt','updatedAt'] },
                    order: [["id", "ASC"]],
            })
        }
        res.send({
                status:200,
                data:{
                    timetable_uuid:timetableData.uuid,
                    routes:routesData || [],
                    prices:pricesData || []
                }
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

const getAllSalesRoutesController = async(req,res)=>{
    const sequelize = getSequelize();
    const { RoutesModel, TimetablePricesModel } = req.app.locals.models;
    try {
        console.log(req.body)
        let routesData = []
        let pricesData = []
            routesData = await RoutesModel.findAll({
                where:{
                    is_active:true
                },
                attributes: { exclude: ['createdAt','updatedAt'] },
                    order: [["id", "ASC"]],
            })
            pricesData = await TimetablePricesModel.findAll({
                where:{
                    is_active:true
                },
                attributes: { exclude: ['createdAt','updatedAt'] },
                    order: [["id", "ASC"]],
            })
        res.send({
                status:200,
                data:{
                    routes:routesData || [],
                    prices:pricesData || []
                }
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

// PATCH /sales_routes/cancel_batch — body: { route_uuids: [], canceled: true|false }
//
// Otkaz polaska mora biti upisan OVDJE, u matičnim podacima. Prodajni servisi
// drže svoje kopije ruta koje se pri sinkronizaciji voznog reda brišu i
// ponovno pune odavde — otkaz upisan samo u kopiju nestane pri prvom idućem
// syncu i polazak se vrati u prodaju.
//
// Uz `sale_status` gasi se i `is_active`, jer se rute prema prodaji distribuiraju
// upravo po tom polju (vidi getAllSalesRoutesController), pa otkazani polazak
// više ni ne izlazi iz ovog servisa.
const cancelSalesRoutesBatchController = async (req, res) => {
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
        // Uredaji sami povlace vozni red; bez ovoga bi otkazan polazak jos
        // prodavali do sljedeceg rucnog osvjezavanja.
        await javiPromjenu("transport", otkazan ? `otkaz polaska (${uuids.length})` : `povrat otkaza (${uuids.length})`);
        res.send({ status: 200, data: { affected, canceled: otkazan } });
    } catch (error) {
        console.log("cancelSalesRoutesBatchController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

// PATCH /sales_routes/reschedule_batch
// body: { route_uuids: [], new_departure: "DD.MM.YYYY. HH:mm" | null }
//
// Pomak polaska. Planirano vrijeme se NE dira — ono je objavljeni vozni red i
// stoji na već izdanim kartama. Novo vrijeme ide u aktualna polja:
// `actual_departure` i `actual_arrival` na ruti, `departure` i `arrival` na
// etapama (departures).
//
// Dispečer zadaje samo vrijeme isplovljenja iz prve luke; razlika prema
// planiranom se primijeni na sve etape, pa trajanja plovidbe između luka
// ostaju kakva jesu. Razlika se uvijek računa od PLANIRANOG, ne od trenutnog
// aktualnog — tako drugi pomak istog polaska ne zbraja pogreške, a
// `new_departure: null` vraća polazak na vozni red.
const rescheduleSalesRoutesBatchController = async (req, res) => {
    const { RoutesModel, DeparturesModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const uuids = Array.isArray(data.route_uuids) ? data.route_uuids : [];
        if (!uuids.length) {
            return res.send({ status: 400, data: { message: "route_uuids required" } });
        }

        const rute = await RoutesModel.findAll({ where: { uuid: uuids } });
        if (!rute.length) {
            return res.send({ status: 404, data: { message: "rute nisu nadjene" } });
        }

        // Prva luka putovanja = etapa s najmanjim rednim brojem isplovljenja.
        const prva = [...rute].sort(
            (a, b) => Number(a.departure_harbor_order) - Number(b.departure_harbor_order)
        )[0];
        const planiraniPocetak = prva.departure;
        const planiraniMin = uMinute(planiraniPocetak);
        if (planiraniMin === null) {
            return res.send({ status: 400, data: { message: `neocekivan oblik planiranog polaska: ${planiraniPocetak}` } });
        }

        let delta = 0;
        if (data.new_departure) {
            const noviMin = uMinute(data.new_departure);
            if (noviMin === null) {
                return res.send({ status: 400, data: { message: "new_departure mora biti oblika DD.MM.YYYY. HH:mm" } });
            }
            delta = noviMin - planiraniMin;
        }

        for (const r of rute) {
            await r.update({
                actual_departure: pomakni(r.departure, delta),
                actual_arrival: pomakni(r.arrival, delta),
            });
        }

        // Etape (departures) nose svoja vremena i iz njih se crta plovidba.
        const depUuids = [...new Set(rute.map((r) => r.departure_uuid).filter(Boolean))];
        const etape = depUuids.length ? await DeparturesModel.findAll({ where: { uuid: depUuids } }) : [];
        for (const d of etape) {
            await d.update({
                departure: pomakni(d.departure_planed, delta),
                arrival: pomakni(d.arrival_planed, delta),
            });
        }

        await javiPromjenu("transport", `pomak polaska ${planiraniPocetak}`);
        res.send({
            status: 200,
            data: {
                affected: rute.length,
                affected_departures: etape.length,
                delta_minutes: delta,
                planned_departure: planiraniPocetak,
                new_departure: delta ? pomakni(planiraniPocetak, delta) : planiraniPocetak,
            },
        });
    } catch (error) {
        console.log("rescheduleSalesRoutesBatchController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

module.exports = {
    getSalesRoutesController,
    getAllSalesRoutesController,
    cancelSalesRoutesBatchController,
    rescheduleSalesRoutesBatchController
}