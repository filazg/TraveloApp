const { getTerminalBasicDataHandler } = require("../../handlers/basicDataHandlers")


const handleGetBasicDataDeskTerminalsFeature = async(req,res)=>{
    try {
        const data = req.body
        console.log('BASIC DATA SYNC',data)
        const basicData = await getTerminalBasicDataHandler(data)
        res.send({
            status:200,
            data:basicData
        })
    } catch (error) {
         res.status(500).send({
            status:500,
            error:error.message
        })
    }
}

module.exports = {
    handleGetBasicDataDeskTerminalsFeature
}