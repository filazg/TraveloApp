const express = require('express');
const { getHarborsDataController } = require('../controllers/dataControllers/harborsControllers');
const { getLinesDataController } = require('../controllers/dataControllers/linesController');
const { getRoutesDataController, cancelRoutesBatchController, rescheduleRoutesBatchController } = require('../controllers/dataControllers/routesController');
const { getPricesDataController } = require('../controllers/dataControllers/pricesController');
const { createOrderController, listOrdersController } = require('../controllers/dataControllers/ordersController');
const { updateOrdersStatusController } = require('../controllers/dataControllers/ordersStatusController');
const router = express.Router();

router
    .route('/harbors')
    .get(getHarborsDataController)

router
    .route('/lines')
    .get(getLinesDataController)

router
    .route('/routes')
    .get(getRoutesDataController)

router
    .route('/routes/cancel_batch')
    .patch(cancelRoutesBatchController)

router
    .route('/routes/reschedule_batch')
    .patch(rescheduleRoutesBatchController)

router
    .route('/prices')
    .get(getPricesDataController)

router
    .route('/orders')
    .get(listOrdersController)
    .post(createOrderController)

router
    .route('/orders_status')
    .post(updateOrdersStatusController)

module.exports = router
