const { getHarborsController, addHarborsController, updateHarborsController } = require("../../controllers/coreServiceControllers/boatServiceControllers.js/harborsServiceControllers")
const { travelo_publisher } = require("../../controllers/publisherController")


const handleGetHarborsFeature = async(req, res) => {
    try {
        const harborsData = await getHarborsController()
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'harbors',
                data: harborsData.data.harbors
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleAddHarborFeature = async(req, res) => {
    try {
        console.log('Adding harbor with data:', req.body);
        const addHarborData = await addHarborsController(req.body)
        const harborsData = await getHarborsController()
        await travelo_publisher('travelo_sales_service', {path:'update_harbors'})
        await travelo_publisher('travelo_web_sales_service', {path:'update_harbors'})
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'harbors',
                data: harborsData.data.harbors
            }
        })
    } catch (error) {
        console.error('Error in handleAddHarborFeature:', error)
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleUpdateHarborFeature = async(req, res) => {
    try {
        const updateHarborData = await updateHarborsController(req.body)
        const harborsData = await getHarborsController()
        await travelo_publisher('travelo_sales_service', {path:'update_harbors'})
        await travelo_publisher('travelo_web_sales_service', {path:'update_harbors'})
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'harbors',
                data: harborsData.data.harbors
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
    handleGetHarborsFeature,
    handleAddHarborFeature,
    handleUpdateHarborFeature
}