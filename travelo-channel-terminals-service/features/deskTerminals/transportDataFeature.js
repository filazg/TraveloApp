const { transportDataHandlers } = require("../../handlers/transportDataHandlers")

const handleGetTransportDataDeskTerminalsFeature = async (req,res)=>{
    try {
        // Uređaj se prepoznaje iz auth headera koji gateway ubaci u body
        // (isto kao basic_data). Bez njega se vraća nefiltrirano.
        const billingDeviceUuid = req.body?.header?.data?.t
        const transportData = await transportDataHandlers(billingDeviceUuid)
        res.send({
            status:200,
            data: transportData
        })
    } catch (error) {
         res.status(500).send({
            status:500,
            error:error.message
        })
    }
}

module.exports = {
    handleGetTransportDataDeskTerminalsFeature
}