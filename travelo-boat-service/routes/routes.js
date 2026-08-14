const express = require('express');
const { getBoatsDataController, addBoatDataController, updateBoatDataController } = require('../controllers/dataControllers/boatControllers');
const { getHarborsDataController, addHarborDataController, updateHarborDataController } = require('../controllers/dataControllers/harborsControllers');
const { getLinesDataController, addLineDataController, updateLineDataController } = require('../controllers/dataControllers/linesControllers');
const { getRegionsDataController, addRegionDataController, updateRegionDataController } = require('../controllers/dataControllers/regionsControllers');
const { getTicketsTypesDataController, addTicketTypeDataController, updateTicketTypeDataController } = require('../controllers/dataControllers/ticketTypesControllers');
const { getTimetableDataController, getTimetableDetailsController, addTimetableDataController } = require('../controllers/dataControllers/timetablesControllers');
const { getSalesRoutesController, getAllSalesRoutesController } = require('../controllers/dataControllers/salesRoutesController');
const { getDeparturesController, getDepartureByUuidController, getRoutesByDepartureController, getRouteByUuidController } = require('../controllers/dataControllers/departuresControllers');
const { getSailingsController, getSailingDetailsController, startSailingController, updateLegStatusController, cancelHarborArrivalController, changeBoatController } = require('../controllers/dataControllers/sailingControllers');
const router = express.Router();

module.exports = router

router
    .route('/boats')
        .get(getBoatsDataController)
        .post(addBoatDataController)
        .patch(updateBoatDataController)

router
    .route('/harbors')
        .get(getHarborsDataController)
        .post(addHarborDataController)
        .patch(updateHarborDataController)

router
    .route('/lines')
        .get(getLinesDataController)
        .post(addLineDataController)
        .patch(updateLineDataController)

router
    .route('/regions')
        .get(getRegionsDataController)
        .post(addRegionDataController)
        .patch(updateRegionDataController)

router
    .route('/tickets_types')
        .get(getTicketsTypesDataController)
        .post(addTicketTypeDataController)
        .patch(updateTicketTypeDataController)

router
    .route('/timetables')
        .get(getTimetableDataController)
        .post(addTimetableDataController)

router
    .route('/timetable_details')
        .post(getTimetableDetailsController)

router
    .route('/sales_routes')
    .get(getAllSalesRoutesController)
    .post(getSalesRoutesController)

router
    .route('/departures')
    .get(getDeparturesController)

router
    .route('/departures/:uuid')
    .get(getDepartureByUuidController)

router
    .route('/departures/:uuid/routes')
    .get(getRoutesByDepartureController)

router
    .route('/routes/:uuid')
    .get(getRouteByUuidController)

router
    .route('/sailings')
    .get(getSailingsController)

router
    .route('/sailings/:uuid')
    .get(getSailingDetailsController)

router
    .route('/sailing/start')
    .post(startSailingController)

router
    .route('/sailing/update_leg')
    .post(updateLegStatusController)

router
    .route('/sailing/cancel_arrival')
    .post(cancelHarborArrivalController)

router
    .route('/dispatcher/change_boat')
    .post(changeBoatController)
