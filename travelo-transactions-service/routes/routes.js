const express = require('express');
const { addTerminalSaleController } = require('../controllers/dataControllers/terminalSaleControllers');
const { createPartnerSaleController, listTicketsForOrderController } = require('../controllers/dataControllers/partnerSaleControllers');
const { renderTicketsPdfController } = require('../controllers/dataControllers/ticketPdfController');
const { finalizeWebSaleController } = require('../controllers/dataControllers/finalizeWebSaleController');
const { renderInvoicePdfController } = require('../controllers/dataControllers/invoicePdfController');
const { listInvoicesController } = require('../controllers/dataControllers/invoicesListController');
const { backfillInvoicesFiscalController } = require('../controllers/dataControllers/invoicesBackfillController');
const { getInvoiceDetailsController } = require('../controllers/dataControllers/invoiceDetailsController');
const { generatePartnerInvoicesController, listPartnerInvoicesController, getPartnerInvoiceDetailsController } = require('../controllers/dataControllers/partnerInvoiceGeneratorController');
const { listTicketsController } = require('../controllers/dataControllers/ticketsSearchController');
const { cancelTicketsController } = require('../controllers/dataControllers/cancelTicketsController');
const { harborTaxReportController } = require('../controllers/dataControllers/harborTaxReportController');
const { harborTaxPdfController } = require('../controllers/dataControllers/harborTaxPdfController');
const { finalizeTerminalSaleController } = require('../controllers/dataControllers/finalizeTerminalSaleController');
const { cancelSailingController, restoreSailingController, rescheduleSailingController, sendSailingMessageController } = require('../controllers/dataControllers/dispatcherController');
const { transferTicketsController } = require('../controllers/dataControllers/ticketTransferControllers');
const { emailInvoiceTicketsController } = require('../controllers/dataControllers/emailInvoiceTicketsController');
const { managementReportController } = require('../controllers/dataControllers/managementReportController');
const { validateTicketController } = require('../controllers/dataControllers/validateTicketController');
const { listBuyersController } = require('../controllers/dataControllers/buyersListController');
const { yescorHealthController } = require('../controllers/dataControllers/yescorHealthController');
const { yescorTestSubmitController } = require('../controllers/dataControllers/yescorTestSubmitController');
const { upsertTerminalShiftController, listShiftsController } = require('../controllers/dataControllers/terminalShiftControllers');
const { apiCreateOrderController, apiGetOrderController, apiConfirmOrderController, apiCancelOrderController, apiTripDetailsController } = require('../controllers/dataControllers/apiOrderControllers');
const { dailyRealizationReportController, sendDailyRealizationToErpController } = require('../controllers/dataControllers/dailyRealizationReportController');
const { dailyRealizationDemoController, sendDailyRealizationDemoToErpController } = require('../controllers/dataControllers/dailyRealizationDemoController');
const { listPaymentOrdersController, getPaymentOrderController, createPaymentOrderController, setPaymentOrderStatusController, addPaymentOrderItemController, deletePaymentOrderItemController, paymentOrderXmlController } = require('../controllers/dataControllers/paymentOrderControllers');
const router = express.Router();

router
    .route('/add_terminal_sale')
    .post(addTerminalSaleController)

router
    .route('/partner_sale')
    .post(createPartnerSaleController)

router
    .route('/tickets')
    .get(listTicketsForOrderController)

router
    .route('/tickets_pdf/:order_uuid')
    .get(renderTicketsPdfController)

// Bulk varijanta — koristi se za "preuzmi sve karte" gumb na download stranici.
// Query: ?order_uuids=uuid1,uuid2,...  → vraća jedan PDF s kartama svih order-a.
router
    .route('/tickets_pdf')
    .get(renderTicketsPdfController)

router
    .route('/finalize_web_sale')
    .post(finalizeWebSaleController)

router
    .route('/invoice_pdf/:invoice_uuid')
    .get(renderInvoicePdfController)

router
    .route('/invoices')
    .get(listInvoicesController)

router
    .route('/invoices_backfill_fiscal')
    .post(backfillInvoicesFiscalController)

router
    .route('/invoice/:invoice_uuid')
    .get(getInvoiceDetailsController)

router
    .route('/partner_invoices/generate')
    .post(generatePartnerInvoicesController)

router
    .route('/partner_invoices')
    .get(listPartnerInvoicesController)

router
    .route('/partner_invoice/:partner_invoice_uuid')
    .get(getPartnerInvoiceDetailsController)

router
    .route('/tickets_search')
    .get(listTicketsController)

router
    .route('/cancel_tickets')
    .post(cancelTicketsController)

router
    .route('/harbor_tax_report')
    .get(harborTaxReportController)

router
    .route('/harbor_tax_report_pdf')
    .get(harborTaxPdfController)

router
    .route('/finalize_terminal_sale')
    .post(finalizeTerminalSaleController)

router
    .route('/cancel_sailing')
    .post(cancelSailingController)

router
    .route('/restore_sailing')
    .post(restoreSailingController)

router
    .route('/reschedule_sailing')
    .post(rescheduleSailingController)

router
    .route('/transfer_tickets')
    .post(transferTicketsController)

router
    .route('/send_sailing_message')
    .post(sendSailingMessageController)

router
    .route('/email_invoice_tickets')
    .post(emailInvoiceTicketsController)

router
    .route('/management_report')
    .get(managementReportController)

router
    .route('/validate_ticket')
    .post(validateTicketController)

router
    .route('/buyers')
    .get(listBuyersController)

router
    .route('/yescor_health')
    .get(yescorHealthController)

router
    .route('/yescor_test_submit')
    .get(yescorTestSubmitController)

// Platni nalozi — povrati kupcu, po provideru (SEPA, MONRI, OTP_POS, SEVENPAY).
router
    .route('/payment_orders')
    .get(listPaymentOrdersController)
    .post(createPaymentOrderController)

router
    .route('/payment_order/:payment_order_uuid')
    .get(getPaymentOrderController)

router
    .route('/payment_order_xml/:payment_order_uuid')
    .get(paymentOrderXmlController)

router
    .route('/payment_order_status')
    .post(setPaymentOrderStatusController)

router
    .route('/payment_order_items')
    .post(addPaymentOrderItemController)

router
    .route('/payment_order_item_delete')
    .post(deletePaymentOrderItemController)

router
    .route('/terminal_shift')
    .post(upsertTerminalShiftController)

router
    .route('/shifts')
    .get(listShiftsController)

// API channel (T4B Transport API v1.05) — partner orders
router
    .route('/api_create_order')
    .post(apiCreateOrderController)

router
    .route('/api_get_order')
    .post(apiGetOrderController)

router
    .route('/api_confirm_order')
    .post(apiConfirmOrderController)

router
    .route('/api_cancel_order')
    .post(apiCancelOrderController)

router
    .route('/api_trip_details')
    .post(apiTripDetailsController)

// Reports — daily realisation (Finance → Izvještaji)
router
    .route('/daily_realization')
    .get(dailyRealizationReportController)

router
    .route('/daily_realization/send_to_erp')
    .post(sendDailyRealizationToErpController)

router
    .route('/daily_realization_demo')
    .get(dailyRealizationDemoController)

router
    .route('/daily_realization_demo/send_to_erp')
    .post(sendDailyRealizationDemoToErpController)

module.exports = router
