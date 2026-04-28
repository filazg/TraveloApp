const { transportDataHandlers } = require("../../handlers/transportDataHandlers")

const handleGetTransportDataDeskTerminalsFeature = async (req,res)=>{
    try {
        const transportData = await transportDataHandlers()
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