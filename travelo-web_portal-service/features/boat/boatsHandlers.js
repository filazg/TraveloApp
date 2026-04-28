const { getBoatsController, addBoatsController, updateBoatsController } = require("../../controllers/coreServiceControllers/boatServiceControllers.js/boatServiceControllers")


const handleGetBoatsFeature = async (req, res) => {
    try {
        const boatsData = await getBoatsController()
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'boats',
                data: boatsData.data.boats
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleAddBoatsFeature = async (req, res) => {
    try {
        const addBoatsData = await addBoatsController(req.body)
        const boatsData = await getBoatsController()
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'boats',
                data: boatsData.data.boats
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleUpdateBoatsFeature = async (req, res) => {
    try {
        const updateBoatsData = await updateBoatsController(req.body)
        const boatsData = await getBoatsController()
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'boats',
                data: boatsData.data.boats
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
    handleGetBoatsFeature,
    handleAddBoatsFeature,
    handleUpdateBoatsFeature
}