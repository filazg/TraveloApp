const { getSequelize } = require("../../config/database");



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
        res.send({ status: 200, data: { affected, canceled: otkazan } });
    } catch (error) {
        console.log("cancelSalesRoutesBatchController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

module.exports = {
    getSalesRoutesController,
    getAllSalesRoutesController,
    cancelSalesRoutesBatchController
}