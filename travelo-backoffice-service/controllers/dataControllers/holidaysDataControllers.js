const { getSequelize } = require("../../config/database")

const sequelize = getSequelize();

const getHolidaysDataController = async(req,res)=>{
    const {HolidaysModel} = req.app.locals.models;
    try {
        // Uz ?all=1 i neaktivni — administracija ih mora vidjeti da bi ih
        // mogla vratiti u upotrebu. Bez toga samo aktivni, kao dosad.
        const holidaysData = await HolidaysModel.findAll({
            where: String(req.query.all) === "1" ? {} : { is_active:true },
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
            // Dupli klik salje samo is_active, uredivanje naziv i datum —
            // sprema se ono sto je poslano.
            const patch = {}
            if (data.is_active !== undefined) patch.is_active = data.is_active
            if (data.name !== undefined) patch.name = data.name
            if (data.date) {
                patch.date_from = data.date
                patch.date_to = data.date
            }
            await HolidaysModel.update(patch,{
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