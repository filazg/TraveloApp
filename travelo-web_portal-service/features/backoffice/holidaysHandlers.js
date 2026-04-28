const { getHolidaysController, addHolidayController, updateHolidayController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/holidaysControllers")


const handleGetHolidaysFeature = async(req,res)=>{
    try {
        const holidaysData = await getHolidaysController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'holidays',
                data:holidaysData.data.holidays
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleAddHolidaysFeature = async(req,res)=>{
    try {
        const addHolidayData = await addHolidayController(req.body)
        const holidaysData = await getHolidaysController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'holidays',
                data:holidaysData.data.holidays
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleUpdateHolidaysFeature = async(req,res)=>{
    try {
        const updateHolidayData = await updateHolidayController(req.body)
        const holidaysData = await getHolidaysController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'holidays',
                data:holidaysData.data.holidays
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
} 

module.exports = {
    handleGetHolidaysFeature,
    handleAddHolidaysFeature,
    handleUpdateHolidaysFeature
}