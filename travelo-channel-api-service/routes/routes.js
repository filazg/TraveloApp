const express = require('express');
const { requireApiPartner } = require('../middlewares/requireApiPartner');
const { validateControlCode } = require('../middlewares/validateControlCode');
const { loginLimiter, partnerLimiter, publicLimiter } = require('../middlewares/rateLimiters');
const { handleApiSalesLoginFeature } = require('../features/apiSales/authLoginFeature');
const { handleGetHarborsDataFeature } = require('../features/apiSales/harborsDataFeatures');
const { handleSearchTripsDataFeature } = require('../features/apiSales/searchTripsFeatures');
const { handleOrderFeature } = require('../features/apiSales/orderFeature');
const { handleConfirmOrderFeature } = require('../features/apiSales/confirmOrderFeature');
const { handleCancelOrderFeature } = require('../features/apiSales/cancelOrderFeature');
const { handleTripDetailsFeature } = require('../features/apiSales/tripDetailsFeature');
const { handleDocumentationFeature } = require('../features/apiSales/documentationFeature');

const router = express.Router();

// SHA512(k + travel_from + travel_date + travel_to)
const searchTripCode = validateControlCode([
    (b) => b.travel_from,
    (b) => b.travel_date,
    (b) => b.travel_to,
]);

// SHA512(k + order_number + order_items.length + subtotal_total_item_prices)
const orderCode = validateControlCode([
    (b) => b.order_number,
    (b) => (Array.isArray(b.order_items) ? b.order_items.length : 0),
    (b) => (Array.isArray(b.order_items) ? b.order_items.reduce((s, i) => s + Number(i.total_item_price || 0), 0) : 0),
]);

// SHA512(k + order_uuid + order_number + total_amount) — order_number/total_amount fetched server-side
// (partner only sends order_uuid + control_code per spec).
const transactionCode = validateControlCode([
    (b) => b.order_uuid,
    (b) => b.__order_number,
    (b) => b.__total_amount,
]);

const fetchOrderForControlCode = async (req, res, next) => {
    try {
        const { apiGetOrderTotal } = require('../controllers/coreServiceControllers/transactionsServiceControllers');
        const result = await apiGetOrderTotal(req.body.order_uuid);
        if (!result || result.status !== 200) {
            return res.status(404).json({ msg: "Order not found" });
        }
        if (result.data.partner_uuid !== req.partner.partner_uuid) {
            return res.status(404).json({ msg: "Order not found" });
        }
        req.body.__order_number = result.data.order_number;
        req.body.__total_amount = Number(result.data.total_amount);
        return next();
    } catch (err) {
        console.log("fetchOrderForControlCode error:", err?.message || err);
        return res.status(500).json({ msg: "Internal error" });
    }
};

router
    .route('/auth/api_sales_login')
    .post(loginLimiter, handleApiSalesLoginFeature);

router
    .route('/harbors')
    .get(requireApiPartner, partnerLimiter, handleGetHarborsDataFeature);

router
    .route('/search_trip')
    .post(requireApiPartner, partnerLimiter, searchTripCode, handleSearchTripsDataFeature);

router
    .route('/order')
    .post(requireApiPartner, partnerLimiter, orderCode, handleOrderFeature);

router
    .route('/confirm_order')
    .post(requireApiPartner, partnerLimiter, fetchOrderForControlCode, transactionCode, handleConfirmOrderFeature);

router
    .route('/cancel_order')
    .post(requireApiPartner, partnerLimiter, fetchOrderForControlCode, transactionCode, handleCancelOrderFeature);

router
    .route('/trip_details')
    .post(requireApiPartner, partnerLimiter, handleTripDetailsFeature);

router
    .route('/documentation')
    .get(publicLimiter, handleDocumentationFeature);

module.exports = router;
