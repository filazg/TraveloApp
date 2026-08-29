const express = require('express');
const { handleGetBasicDataDeskTerminalsFeature } = require('../features/deskTerminals/basicDataFeatures');
const { handleGetTransportDataDeskTerminalsFeature } = require('../features/deskTerminals/transportDataFeature');
const { handleAddInvoiceDataDeskTerminalFeature, handleGetInvoiceStatusFeature } = require('../features/deskTerminals/invoiceDataFeature');
const { handleGetBookingDataDeskTerminalsFeature } = require('../features/deskTerminals/bookingDataFeature');
const { handleFinalizeSaleFeature } = require('../features/deskTerminals/finalizeSaleFeature');
const { handleVoyageTicketsFeature, handleValidateTicketFeature, handleBuyersListFeature } = require('../features/deskTerminals/voyageTicketsFeature');
const { handleCheckIslandCardFeature, handleCancelTicketsFeature } = require('../features/deskTerminals/akdFeature');
const { handleUpsertTerminalShiftFeature, handleListShiftsFeature } = require('../features/deskTerminals/shiftDataFeature');
const { handleExternalTicketFeature } = require('../features/deskTerminals/externalTicketFeature');
const { handleGetSyncSignalsFeature } = require('../features/deskTerminals/syncSignalFeature');
const router = express.Router();

router
    .route('/terminal/basic_data')
    .get(handleGetBasicDataDeskTerminalsFeature)
// Lagana provjera je li se sto promijenilo (storno, otkaz i pomak polaska).
router
    .route('/terminal/sync_signals')
    .get(handleGetSyncSignalsFeature)

router
    .route('/terminal/transport_data')
    .get(handleGetTransportDataDeskTerminalsFeature)

router
    .route('/terminal/add_invoices')
    .post(handleAddInvoiceDataDeskTerminalFeature)

router
    .route('/terminal/invoice/:invoice_uuid')
    .get(handleGetInvoiceStatusFeature)

router
    .route('/terminal/booking')
    .post(handleGetBookingDataDeskTerminalsFeature)

router
    .route('/terminal/finalize_sale')
    .post(handleFinalizeSaleFeature)

router
    .route('/terminal/voyage_tickets')
    .get(handleVoyageTicketsFeature)

router
    .route('/terminal/validate_ticket')
    .post(handleValidateTicketFeature)

router
    .route('/terminal/buyers')
    .get(handleBuyersListFeature)

router
    .route('/terminal/check_island_card')
    .post(handleCheckIslandCardFeature)

router
    .route('/terminal/cancel_tickets')
    .post(handleCancelTicketsFeature)

// Traženje karte prodane na drugom prodajnom mjestu, za storno na blagajni.
router
    .route('/terminal/external_ticket')
    .get(handleExternalTicketFeature)

router
    .route('/terminal/shift')
    .post(handleUpsertTerminalShiftFeature)

router
    .route('/terminal/shifts')
    .get(handleListShiftsFeature)

module.exports = router
