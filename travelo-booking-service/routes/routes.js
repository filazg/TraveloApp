const express = require("express");
const {
    getCategoriesController,
    addCategoryController,
    updateCategoryController,
} = require("../controllers/dataControllers/capacityCategoriesController");
const {
    getMappingsController,
    addMappingController,
    updateMappingController,
} = require("../controllers/dataControllers/ticketTypeMappingsController");
const {
    initBookingsController,
    getBookingsController,
    reserveBookingsController,
    releaseBookingsController,
    setAdditionalCapacityController,
    recalcCapacityController,
    validateTicketsController,
} = require("../controllers/dataControllers/bookingsController");

const router = express.Router();

router
    .route("/capacity_categories")
    .get(getCategoriesController)
    .post(addCategoryController)
    .patch(updateCategoryController);

router
    .route("/ticket_type_mappings")
    .get(getMappingsController)
    .post(addMappingController)
    .patch(updateMappingController);

router.route("/bookings").get(getBookingsController);
router.route("/bookings/init").post(initBookingsController);
router.route("/bookings/reserve").post(reserveBookingsController);
router.route("/bookings/release").post(releaseBookingsController);
router.route("/bookings/additional").patch(setAdditionalCapacityController);
router.route("/bookings/recalc_capacity").post(recalcCapacityController);
router.route("/bookings/validate").post(validateTicketsController);

module.exports = router;
