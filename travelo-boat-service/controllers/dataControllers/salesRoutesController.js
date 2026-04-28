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

module.exports = {
    getSalesRoutesController,
    getAllSalesRoutesController
}