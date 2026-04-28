const { getPartnersController, addPartnerController, updatePartnerController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/partnersServiceControllers")

const handleGetPartnersFeature = async(req,res)=>{
    try {
        console.log('TU SMO PARTNER')
        const partnersData = await getPartnersController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'partners',
                data:partnersData.data.partners
            }
        })
    } catch (error) {
         res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleAddPartnerFeature = async(req,res)=>{
    try {
        const addPartnerData = await addPartnerController(req.body)
        const partnersData = await getPartnersController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'partners',
                data:partnersData.data.partners
            }
        })
    } catch (error) {
         res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleUpdatePartnerrFeature = async(req,res)=>{
    try {
        const updatePartnerData = await updatePartnerController(req.body)
        const partnersData = await getPartnersController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'partners',
                data:partnersData.data.partners
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
    handleGetPartnersFeature,
    handleAddPartnerFeature,
    handleUpdatePartnerrFeature
}