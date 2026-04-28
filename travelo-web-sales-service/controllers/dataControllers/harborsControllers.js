const { getSequelize } = require("../../config/database");

const getHarborsDataController = async (req, res) => {
    const sequelize = getSequelize();
    const { HarborsModel } = req.app.locals.models;    
    try {
        const result = await sequelize.transaction(async (t)=>{
            const harborsData = await HarborsModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            })
            res.send({
                status:200,                
                path:'transportData',
                data:{
                    harbors:harborsData
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
const getWebPageHarborsDataController = async (req, res) => {
    const sequelize = getSequelize();
    const { HarborsModel } = req.app.locals.models;    
    try {
        const result = await sequelize.transaction(async (t)=>{
            const harborsData = await HarborsModel.findAll({
                attributes: { exclude: ['id','seop_island','region', 'createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            })
            res.send({
                harbors:harborsData           
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

module.exports = {
    getHarborsDataController,
    getWebPageHarborsDataController
}