const { getRegionsController, addRegionsController, updateRegionsController } = require("../../controllers/coreServiceControllers/boatServiceControllers.js/regionsServiceControllers")


const handleGetRegionsFeature = async (req, res) => {
    try {
        const regionsData = await getRegionsController()
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'regions',
                data: regionsData.data.regions
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleAddRegionFeature = async (req, res) => {
    try {
        const addRegionData = await addRegionsController(req.body)
        const regionsData = await getRegionsController()
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'regions',
                data: regionsData.data.regions
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleUpdateRegionFeature = async (req, res) => {
    try {
        const updateRegionData = await updateRegionsController(req.body)
        const regionsData = await getRegionsController()
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'regions',
                data: regionsData.data.regions
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
    handleGetRegionsFeature,
    handleAddRegionFeature,
    handleUpdateRegionFeature
}