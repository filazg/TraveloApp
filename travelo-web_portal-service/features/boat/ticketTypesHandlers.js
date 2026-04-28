const { getTicketTypesController, addTicketTypesController, updateTicketTypesController } = require("../../controllers/coreServiceControllers/boatServiceControllers.js/ticketsTypesServiceControllers")


const handleGetTicketTypesFeature = async (req, res) => {
    try {
        const ticketTypesData = await getTicketTypesController()
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'tickets_types',
                data: ticketTypesData.data.ticketTypes
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleAddTicketTypesFeature = async (req, res) => {
    try {
        const addTicketTypesData = await addTicketTypesController(req.body)
        const ticketTypesData = await getTicketTypesController()
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'tickets_types',
                data: ticketTypesData.data.ticketTypes
            }
        })
    } catch (error) {
        res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleUpdateTicketTypesFeature = async (req, res) => {
    try {
        const updateTicketTypesData = await updateTicketTypesController(req.body)
        const ticketTypesData = await getTicketTypesController()
        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'tickets_types',
                data: ticketTypesData.data.ticketTypes
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
    handleGetTicketTypesFeature,
    handleAddTicketTypesFeature,
    handleUpdateTicketTypesFeature
}