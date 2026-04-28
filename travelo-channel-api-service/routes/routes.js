const express = require('express');
const { handleGetHarborsDataFeature } = require('../features/apiSales/harborsDataFeatures');
const { handleSearchTripsDataFeature } = require('../features/apiSales/searchTripsFeatures');
const router = express.Router();

router
    .route('/harbors')
    .get(handleGetHarborsDataFeature)

router
    .route('/search_trip')
    .post(handleSearchTripsDataFeature)

// TODO: handlers not implemented yet — routes disabled to allow service to boot
// router.route('/order').post(handleApiSaleOrderCreate)
// router.route('/confirm_order').post(handleApiSaleConfirmOrder)
// router.route('/cancel_order').post(handleApiSaleCancelOrder)
// router.route('/trip_details').post(handleTripDetails)
// router.route('/cancel').post(handleCancelApi)

module.exports = router