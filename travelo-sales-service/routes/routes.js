const express = require('express');
const { getHarborsDataController } = require('../controllers/dataControllers/harborsControllers');
const { getLinesDataController } = require('../controllers/dataControllers/linesController');
const { getRoutesDataController, cancelRoutesBatchController, rescheduleRoutesBatchController } = require('../controllers/dataControllers/routesController');
const { getPricesDataController } = require('../controllers/dataControllers/pricesController');
const { createOrderController, listOrdersController, listOrderTicketsController } = require('../controllers/dataControllers/ordersController');
const { updateOrdersStatusController } = require('../controllers/dataControllers/ordersStatusController');
const { provjeriPartnersku, traziUlogu } = require('../middlewares/partnerSession');
const {
    partnerCommissionController,
    partnerCommissionDetailsController,
    partnerCommissionReportPdfController,
    partnerInvoicesController,
    partnerInvoiceController,
    partnerInvoicePdfController,
} = require('../controllers/dataControllers/partnerFinanceController');

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

// Karte jedne rezervacije — partnerski pregled "moje rezervacije".
router
    .route('/order_tickets')
    .get(listOrderTicketsController)

router
    .route('/orders_status')
    .post(updateOrdersStatusController)


// Financijski pregled partnera. Partner dolazi iz prijave, ne iz upita, a
// uloga FINANCE je zasebna od prodaje: prodavac ovdje nema sto traziti.
const samoFinancije = [provjeriPartnersku, traziUlogu('FINANCE')];

router
    .route('/partner_finance/commission')
    .get(samoFinancije, partnerCommissionController)

router
    .route('/partner_finance/commission_details')
    .get(samoFinancije, partnerCommissionDetailsController)

router
    .route('/partner_finance/report_pdf')
    .get(samoFinancije, partnerCommissionReportPdfController(false))

router
    .route('/partner_finance/report_details_pdf')
    .get(samoFinancije, partnerCommissionReportPdfController(true))

router
    .route('/partner_finance/invoices')
    .get(samoFinancije, partnerInvoicesController)

router
    .route('/partner_finance/invoice/:partner_invoice_uuid')
    .get(samoFinancije, partnerInvoiceController)

router
    .route('/partner_finance/invoice_pdf/:partner_invoice_uuid')
    .get(samoFinancije, partnerInvoicePdfController(false))

router
    .route('/partner_finance/invoice_details_pdf/:partner_invoice_uuid')
    .get(samoFinancije, partnerInvoicePdfController(true))

module.exports = router
