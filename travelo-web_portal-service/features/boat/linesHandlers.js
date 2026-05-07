const { getLinesController, addLinesController, updateLinesController } = require("../../controllers/coreServiceControllers/boatServiceControllers.js/linesServiceControllers")
const { travelo_publisher } = require("../../controllers/publisherController")

const handleGetLinesFeature = async (req, res) => {
    try {
        const linesData = await getLinesController()
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'lines',
                data: linesData.data.lines
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleAddLinesFeature = async (req, res) => {
    try {
        const addLinesData = await addLinesController(req.body)
        const linesData = await getLinesController()
        await travelo_publisher('travelo_sales_service', {path:'update_lines'})
        await travelo_publisher('travelo_web_sales_service', {path:'update_lines'})
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'lines',
                data: linesData.data.lines
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleUpdateLinesFeature = async (req, res) => {
    try {
        const updateLinesData = await updateLinesController(req.body)
        const linesData = await getLinesController()
        await travelo_publisher('travelo_sales_service', {path:'update_lines'})
        await travelo_publisher('travelo_web_sales_service', {path:'update_lines'})
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'lines',
                data: linesData.data.lines
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
    handleGetLinesFeature,
    handleAddLinesFeature,
    handleUpdateLinesFeature
}