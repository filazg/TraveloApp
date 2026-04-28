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
const { finalizeTerminalSaleController } = require('../controllers/dataControllers/finalizeTerminalSaleController');
const { cancelSailingController, sendSailingMessageController } = require('../controllers/dataControllers/dispatcherController');
const { emailInvoiceTicketsController } = require('../controllers/dataControllers/emailInvoiceTicketsController');
const { managementReportController } = require('../controllers/dataControllers/managementReportController');
const { validateTicketController } = require('../controllers/dataControllers/validateTicketController');
const { listBuyersController } = require('../controllers/dataControllers/buyersListController');
const { yescorHealthController } = require('../controllers/dataControllers/yescorHealthController');
const { yescorTestSubmitController } = require('../controllers/dataControllers/yescorTestSubmitController');
const { upsertTerminalShiftController, listShiftsController } = require('../controllers/dataControllers/terminalShiftControllers');
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
    .route('/finalize_terminal_sale')
    .post(finalizeTerminalSaleController)

router
    .route('/cancel_sailing')
    .post(cancelSailingController)

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

router
    .route('/terminal_shift')
    .post(upsertTerminalShiftController)

router
    .route('/shifts')
    .get(listShiftsController)

module.exports = router
