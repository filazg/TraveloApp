const { getSudregLookupController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/sudregServiceControllers")

const handleGetSudregFeature = async(req,res)=>{
    try {
        const oib = req.query.oib
        const sudregData = await getSudregLookupController(oib)
        res.send({
            status:200,
            data: sudregData.data
        })
    } catch (error) {
         res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

module.exports = {
    handleGetSudregFeature
}
