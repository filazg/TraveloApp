const { getSequelize } = require("../../config/database")

const sequelize = getSequelize();

const getHolidaysDataController = async(req,res)=>{
    const {HolidaysModel} = req.app.locals.models;
    try {
        const holidaysData = await HolidaysModel.findAll({
            where:{
                is_active:true
            },
            attributes: { exclude: ['createdAt','updatedAt']},
            order:['id']
        })
        res.send({
            status:200,
            data:{
                holidays:holidaysData
            }
        })
    } catch (error) {
        
    }
}

const addHolidayDataController = async(req,res)=>{
    const {HolidaysModel} = req.app.locals.models;
    try {
        const data = req.body.body
        console.log(data)
        const result = await sequelize.transaction(async (t)=>{
            const addHoliday = await HolidaysModel.create({
                uuid:crypto.randomUUID(16),
                name:data.name,
                date_from:data.date,
                date_to:data.date,
                is_active:true
            })
            res.send({
                status:201,
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

const updateHolidayDataController = async(req,res)=>{
    const {HolidaysModel} = req.app.locals.models;
    try {
        const data = req.body.body
        const result = await sequelize.transaction(async (t)=>{
        const holidayExist = await HolidaysModel.findOne({
            where:{
                uuid:data.uuid
            }
        })
        if(holidayExist){
            await HolidaysModel.update({
                is_active:data.is_active
            },{
                where:{
                    uuid:data.uuid
                }
            })
        }
         res.send({
            status:201,
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
    getHolidaysDataController,
    addHolidayDataController,
    updateHolidayDataController
}