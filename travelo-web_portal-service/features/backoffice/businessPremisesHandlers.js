const { getBusinessPremisesController, addBusinessPremisesController, updateBusinessPremisesController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/businessPremisesServiceControllers")

const handleGetBusinessPremisesFeature = async(req,res)=>{
    try {
        const businessPremisesData = await getBusinessPremisesController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'business_premises',
                data:businessPremisesData.data.business_premises
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleAddBusinessPremisesFeature = async(req,res)=>{
    try {
        const addBusinessPremisesData = await addBusinessPremisesController(req.body)
        const businessPremisesData = await getBusinessPremisesController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'business_premises',
                data:businessPremisesData.data.business_premises
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleUpdateBusinessPremisesFeature = async(req,res)=>{
    try {
        console.log('Updating business premises with data:', req.body);
        const updateBusinessPremisesData = await updateBusinessPremisesController(req.body)
        const businessPremisesData = await getBusinessPremisesController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'business_premises',
                data:businessPremisesData.data.business_premises
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
    handleGetBusinessPremisesFeature,
    handleAddBusinessPremisesFeature,
    handleUpdateBusinessPremisesFeature
}