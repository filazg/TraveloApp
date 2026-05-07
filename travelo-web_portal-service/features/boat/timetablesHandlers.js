const { addTimetableController, getTimetablesController, getTimetablesDetailsController } = require("../../controllers/coreServiceControllers/boatServiceControllers.js/timetablesServiceControllers");
const { travelo_publisher } = require("../../controllers/publisherController");

const handleGetTimetablesFeature = async (req, res) => {
    try {
        const getTimetables = await getTimetablesController()
        res.send({
            status:200,
            data:{
                path1:'boatData',
                path2:'timetables',
                data:getTimetables.data.timetables
            }
        })
    } catch (error) {
        res.status(500).send({
            status:500,
            error:error.message
        })
    }
}

const handleGetTimetableDetailsFeatures = async (req, res) => {
    try {
        console.log('DETAIL timetables with data:', req.body);
        const dataToSend = {
            user: req.body.header,
            data: req.body.body
        }
        const getDetails = await getTimetablesDetailsController(dataToSend)
        res.send({
            status:200,
            data:{
                path1:'boatData',
                path2:'timetable_details',
                data:getDetails.data.timetable_details
            }
        })
    } catch (error) {
            res.status(500).send({
                status:500,
                error:error.message
            })
    }
}
const handleAddTimetablesFeatures = async (req, res) => {
    try {
        console.log('Adding timetables with data:', req.body);
        const dataToSend = {
            user: req.body.header,
            data: req.body.body
        }
        const addTimetable = await addTimetableController(dataToSend)
        const getTimetables = await getTimetablesController()
        await travelo_publisher('travelo_sales_service', {path:'update_sales_routes',data:dataToSend.data.timetableData.code})
        await travelo_publisher('travelo_transactions_service', {path:'update_sales_routes',data:dataToSend.data.timetableData.code})
        await travelo_publisher('travelo_web_sales_service', {path:'update_sales_routes',data:dataToSend.data.timetableData.code})
        res.send({
            status:200,
            data:{
                path1:'boatData',
                path2:'timetables',
                data:getTimetables.data.timetables
            }
        })
    } catch (error) {
            res.status(500).send({
                status:500,
                error:error.message
            })
    }
}

module.exports = {
    handleGetTimetablesFeature,
    handleGetTimetableDetailsFeatures,
    handleAddTimetablesFeatures
}