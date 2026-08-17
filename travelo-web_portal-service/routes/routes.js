const express = require('express');
const { handleGetCompanyFeature, handleUpdateCompanyFeature } = require('../features/backoffice/companyHandlers');
const { handleGetBusinessPremisesFeature, handleAddBusinessPremisesFeature, handleUpdateBusinessPremisesFeature } = require('../features/backoffice/businessPremisesHandlers');
const { handleGetPaymentMethodsFeature, handleAddPaymentMethodsFeature, handleUpdatePaymentMethodsFeature } = require('../features/backoffice/paymentMethodsHandlers');
const { handleGetPaymentTypesFeature } = require('../features/backoffice/paymentTypesHandlers');
const { handleGetUsersFeature, handleAddUsersFeature, handleUpdateUsersFeature } = require('../features/backoffice/usersHandlers');
const { handleGetBillingDevicesFeature, handleAddBillingDevicesFeature, handleUpdateBillingDevicesFeature, handleGetNextTidFeature, handleGetNextOtpFeature, handleGetDeviceModelsFeature, handleGetDeviceSerialNumbersFeature } = require('../features/backoffice/billingDevicesHandlers');
const { handleAddTimetablesFeatures, handleGetTimetablesFeature, handleGetTimetableDetailsFeatures } = require('../features/boat/timetablesHandlers');
const { handleGetHarborsFeature, handleAddHarborFeature, handleUpdateHarborFeature } = require('../features/boat/harborsHandlers');
const { handleGetBoatsFeature, handleAddBoatsFeature, handleUpdateBoatsFeature } = require('../features/boat/boatsHandlers');
const { handleGetLinesFeature, handleAddLinesFeature, handleUpdateLinesFeature } = require('../features/boat/linesHandlers');
const { handleGetRegionsFeature, handleAddRegionFeature, handleUpdateRegionFeature } = require('../features/boat/regionsHandlers');
const { handleGetTicketTypesFeature, handleAddTicketTypesFeature, handleUpdateTicketTypesFeature } = require('../features/boat/ticketTypesHandlers');
const { handleGetPartnersFeature, handleAddPartnerFeature, handleUpdatePartnerrFeature } = require('../features/backoffice/partnersHandlers');
const { handleGetAddressbookFeature, handleAddAddressbookFeature, handleUpdateAddressbookFeature } = require('../features/backoffice/addressbookHandlers');
const { handleGetHolidaysFeature, handleAddHolidaysFeature, handleUpdateHolidaysFeature } = require('../features/backoffice/holidaysHandlers');
const { handleGetCountriesFeature, handleAddCountryFeature, handleUpdateCountryFeature } = require('../features/backoffice/countriesHandlers');
const { handleGetChannelSettingsFeature, handleGetChannelSettingFeature, handleUpsertChannelSettingFeature } = require('../features/backoffice/channelSettingsHandlers');
const { handleGetAccountsFeature, handleAddAccountFeature, handleUpdateAccountFeature, handleGetAccountMappingsFeature, handleUpsertAccountMappingFeature } = require('../features/backoffice/accountsHandlers');
const { handleGetDailyRealizationFeature, handleSendDailyRealizationToErpFeature, handleGetDailyRealizationDemoFeature, handleSendDailyRealizationDemoToErpFeature } = require('../features/transactions/dailyRealizationHandlers');
const { handleGetInvoicesFeature, handleGetInvoicePdfFeature, handleGetInvoiceDetailsFeature, handleEmailInvoiceTicketsFeature } = require('../features/transactions/invoicesHandlers');
const { handleGetManagementReportFeature } = require('../features/transactions/managementReportHandlers');
const { handleGetPartnerInvoicesFeature, handleGetPartnerInvoiceDetailsFeature } = require('../features/transactions/partnerInvoicesHandlers');
const { handleSearchTicketsFeature, handleCancelTicketsFeature, handleGetTicketsPdfFeature } = require('../features/transactions/ticketsHandlers');
const { handleGetHarborTaxReportFeature } = require('../features/transactions/harborTaxReportHandler');
const { handleFinalizeTerminalSaleFeature, handleGetSalesRoutesFeature, handleGetSalesPricesFeature } = require('../features/transactions/terminalSaleHandler');
const { handleCancelSailingFeature, handleSendSailingMessageFeature } = require('../features/transactions/dispatcherHandler');
const { handleGetShiftsFeature } = require('../features/transactions/shiftsHandlers');
const {
    handleGetCapacityCategoriesFeature,
    handleAddCapacityCategoryFeature,
    handleUpdateCapacityCategoryFeature,
    handleGetBookingsFeature,
    handleGetTicketTypeMappingsFeature,
    handleAddTicketTypeMappingFeature,
    handleUpdateTicketTypeMappingFeature,
} = require('../features/booking/bookingHandlers');
const {
    handleGetSailingsFeature,
    handleGetSailingDetailsFeature,
    handleStartSailingFeature,
    handleUpdateLegStatusFeature,
    handleCancelHarborArrivalFeature,
    handleChangeBoatFeature,
} = require('../features/boat/sailingHandlers');
const { handleGetModulesConfigFeature } = require('../features/system/modulesHandler');
const { handleGetDownloadsFeature, handleDownloadFileFeature } = require('../features/system/downloadsHandler');
const {
    handleGetBusLinesFeature, handleAddBusLineFeature, handleUpdateBusLineFeature,
    handleGetBusVehiclesFeature, handleAddBusVehicleFeature, handleUpdateBusVehicleFeature,
    handleGetBusStopsFeature, handleAddBusStopFeature, handleUpdateBusStopFeature,
    handleGetBusTicketsTypesFeature, handleAddBusTicketTypeFeature, handleUpdateBusTicketTypeFeature,
} = require('../features/bus/busHandlers');
const {
    handleGetBusTimetablesFeature,
    handleAddBusTimetablesFeatures,
    handleGetBusTimetableDetailsFeatures,
} = require('../features/bus/timetablesHandlers');
const {
    handleGetBusPricelistsFeature,
    handleUpsertBusPricelistFeature,
    handleRefreshBusTimetablePricesFeature,
} = require('../features/bus/pricelistsHandlers');
const {
    handleGetBusSalesRoutesFeature,
    handleGetBusSalesPricesFeature,
} = require('../features/bus/salesHandlers');
const {
    handleGetBusBookingsFeature,
    handleInitBusBookingsFeature,
    handleReserveBusBookingsFeature,
    handleReleaseBusBookingsFeature,
    handleSetBusAdditionalCapacityFeature,
    handleValidateBusTicketsFeature,
    handleGetBusSeatsFeature,
} = require('../features/bus/bookingsHandlers');
const {
    handleGetBusSailingsFeature,
    handleGetBusSailingDetailsFeature,
    handleCancelBusSailingFeature,
    handleSendBusSailingMessageFeature,
    handleChangeBusVehicleFeature,
    handleSetBusVoyageDelayFeature,
} = require('../features/bus/dispatcherHandlers');
const {
    handleSetBusVoyageStatusFeature,
} = require('../features/bus/driverHandlers');
const {
    handleGetBusDrivingPlansFeature,
    handleUpsertBusDrivingPlanFeature,
    handleDeleteBusDrivingPlanFeature,
    handleGetBusPlanVoyagesFeature,
    handleGetBusPlanVoyagesByQueryFeature,
    handleGetBusTimetableVoyagesSummaryFeature,
    handleGetBusVoyageLegsFeature,
} = require('../features/bus/drivingPlansHandlers');
const {
    handleGetBusPutniRadniListoviFeature,
    handleGetBusPutniRadniListDetailFeature,
    handleIzdajBusPutniRadniListFeature,
    handlePrekiniBusPutniRadniListFeature,
    handleZavrsiBusPutniRadniListFeature,
    handleOtkaziBusPutniRadniListFeature,
    handleGetBusPutniRadniListPdfFeature,
} = require('../features/bus/putniRadniListHandlers');
const {
    handleFinalizeBusCartSaleFeature,
    handleGetBusInvoicesFeature,
    handleGetBusInvoiceDetailFeature,
    handleCancelBusInvoiceFeature,
    handleGetBusInvoicePdfFeature,
} = require('../features/bus/invoicesHandlers');
const router = express.Router();

//BACKOFFICE ROUTES
router
    .route('/backoffice/company')
    .get(handleGetCompanyFeature)
    .patch(handleUpdateCompanyFeature)

router
    .route('/backoffice/business_premises')
    .get(handleGetBusinessPremisesFeature)
    .post(handleAddBusinessPremisesFeature)
    .patch(handleUpdateBusinessPremisesFeature)

router
    .route('/backoffice/billing_devices')
    .get(handleGetBillingDevicesFeature)
    .post(handleAddBillingDevicesFeature)
    .patch(handleUpdateBillingDevicesFeature)

router
    .route('/backoffice/billing_devices/next_tid')
    .get(handleGetNextTidFeature)

router
    .route('/backoffice/billing_devices/next_otp')
    .get(handleGetNextOtpFeature)

router
    .route('/backoffice/channel_settings')
    .get(handleGetChannelSettingsFeature)

router
    .route('/backoffice/channel_settings/:channel')
    .get(handleGetChannelSettingFeature)
    .patch(handleUpsertChannelSettingFeature)

router
    .route('/backoffice/device_models')
    .get(handleGetDeviceModelsFeature)

router
    .route('/backoffice/device_serial_numbers')
    .get(handleGetDeviceSerialNumbersFeature)

router
    .route('/backoffice/payment_methods')
    .get(handleGetPaymentMethodsFeature)
    .post(handleAddPaymentMethodsFeature)
    .patch(handleUpdatePaymentMethodsFeature)

router
    .route('/backoffice/users')
    .get(handleGetUsersFeature)
    .post(handleAddUsersFeature)
    .patch(handleUpdateUsersFeature)

router
    .route('/backoffice/payment_types')
    .get(handleGetPaymentTypesFeature)

router
    .route('/backoffice/partners')
    .get(handleGetPartnersFeature)
    .post(handleAddPartnerFeature)
    .patch(handleUpdatePartnerrFeature)

router
    .route('/backoffice/addressbook')
    .get(handleGetAddressbookFeature)
    .post(handleAddAddressbookFeature)
    .patch(handleUpdateAddressbookFeature)

router
    .route('/backoffice/holidays')
    .get(handleGetHolidaysFeature)
    .post(handleAddHolidaysFeature)
    .patch(handleUpdateHolidaysFeature)

router
    .route('/backoffice/countries')
    .get(handleGetCountriesFeature)
    .post(handleAddCountryFeature)
    .patch(handleUpdateCountryFeature)

router
    .route('/backoffice/accounts')
    .get(handleGetAccountsFeature)
    .post(handleAddAccountFeature)
    .patch(handleUpdateAccountFeature)

router
    .route('/backoffice/account_mappings')
    .get(handleGetAccountMappingsFeature)
    .post(handleUpsertAccountMappingFeature)

//BOAT ROUTES
router
    .route('/boat/boats')
    .get(handleGetBoatsFeature)
    .post(handleAddBoatsFeature)
    .patch(handleUpdateBoatsFeature)

router
    .route('/boat/harbors')
    .get(handleGetHarborsFeature)
    .post(handleAddHarborFeature)
    .patch(handleUpdateHarborFeature)

router
    .route('/boat/lines')
    .get(handleGetLinesFeature)
    .post(handleAddLinesFeature)
    .patch(handleUpdateLinesFeature)

router
    .route('/boat/regions')
    .get(handleGetRegionsFeature)
    .post(handleAddRegionFeature)
    .patch(handleUpdateRegionFeature)

router
    .route('/boat/tickets_types')
    .get(handleGetTicketTypesFeature)
    .post(handleAddTicketTypesFeature)
    .patch(handleUpdateTicketTypesFeature)

router
    .route('/boat/timetables')
    .get(handleGetTimetablesFeature)
    .post(handleAddTimetablesFeatures)

router
    .route('/boat/timetable_details')
    .post(handleGetTimetableDetailsFeatures)

//FINANCE / TRANSACTIONS ROUTES
router
    .route('/transactions/invoices')
    .get(handleGetInvoicesFeature)

router
    .route('/transactions/invoice_pdf/:invoice_uuid')
    .get(handleGetInvoicePdfFeature)

router
    .route('/transactions/invoice/:invoice_uuid')
    .get(handleGetInvoiceDetailsFeature)

router
    .route('/transactions/email_invoice_tickets')
    .post(handleEmailInvoiceTicketsFeature)

router
    .route('/transactions/management_report')
    .get(handleGetManagementReportFeature)

router
    .route('/transactions/partner_invoices')
    .get(handleGetPartnerInvoicesFeature)

router
    .route('/transactions/partner_invoice/:partner_invoice_uuid')
    .get(handleGetPartnerInvoiceDetailsFeature)

router
    .route('/transactions/tickets_search')
    .get(handleSearchTicketsFeature)

router
    .route('/transactions/tickets_pdf/:order_uuid')
    .get(handleGetTicketsPdfFeature)

router
    .route('/transactions/cancel_tickets')
    .post(handleCancelTicketsFeature)

router
    .route('/transactions/shifts')
    .get(handleGetShiftsFeature)

router
    .route('/transactions/harbor_tax_report')
    .get(handleGetHarborTaxReportFeature)

router
    .route('/transactions/daily_realization')
    .get(handleGetDailyRealizationFeature)

router
    .route('/transactions/daily_realization/send_to_erp')
    .post(handleSendDailyRealizationToErpFeature)

router
    .route('/transactions/daily_realization_demo')
    .get(handleGetDailyRealizationDemoFeature)

router
    .route('/transactions/daily_realization_demo/send_to_erp')
    .post(handleSendDailyRealizationDemoToErpFeature)

router
    .route('/transactions/finalize_terminal_sale')
    .post(handleFinalizeTerminalSaleFeature)

router
    .route('/sales/routes')
    .get(handleGetSalesRoutesFeature)

router
    .route('/sales/prices')
    .get(handleGetSalesPricesFeature)

router
    .route('/dispatcher/change_boat')
    .post(handleChangeBoatFeature)

router
    .route('/dispatcher/cancel_sailing')
    .post(handleCancelSailingFeature)

router
    .route('/dispatcher/send_sailing_message')
    .post(handleSendSailingMessageFeature)

router
    .route('/booking/capacity_categories')
    .get(handleGetCapacityCategoriesFeature)
    .post(handleAddCapacityCategoryFeature)
    .patch(handleUpdateCapacityCategoryFeature)

router
    .route('/booking/ticket_type_mappings')
    .get(handleGetTicketTypeMappingsFeature)
    .post(handleAddTicketTypeMappingFeature)
    .patch(handleUpdateTicketTypeMappingFeature)

router
    .route('/booking/bookings')
    .get(handleGetBookingsFeature)

//SAILING (Kapetan)
router
    .route('/sailing/sailings')
    .get(handleGetSailingsFeature)

router
    .route('/sailing/sailings/:uuid')
    .get(handleGetSailingDetailsFeature)

router
    .route('/sailing/start')
    .post(handleStartSailingFeature)

router
    .route('/sailing/update_leg')
    .post(handleUpdateLegStatusFeature)

router
    .route('/sailing/cancel_arrival')
    .post(handleCancelHarborArrivalFeature)

//SYSTEM
router
    .route('/system/modules')
    .get(handleGetModulesConfigFeature)

//PREUZIMANJA
router
    .route('/downloads/list')
    .get(handleGetDownloadsFeature)

router
    .route('/downloads/file/:file')
    .get(handleDownloadFileFeature)

//BUS ROUTES
router
    .route('/bus/lines')
    .get(handleGetBusLinesFeature)
    .post(handleAddBusLineFeature)
    .patch(handleUpdateBusLineFeature)

router
    .route('/bus/vehicles')
    .get(handleGetBusVehiclesFeature)
    .post(handleAddBusVehicleFeature)
    .patch(handleUpdateBusVehicleFeature)

router
    .route('/bus/stops')
    .get(handleGetBusStopsFeature)
    .post(handleAddBusStopFeature)
    .patch(handleUpdateBusStopFeature)

router
    .route('/bus/tickets_types')
    .get(handleGetBusTicketsTypesFeature)
    .post(handleAddBusTicketTypeFeature)
    .patch(handleUpdateBusTicketTypeFeature)

router
    .route('/bus/timetables')
    .get(handleGetBusTimetablesFeature)
    .post(handleAddBusTimetablesFeatures)

router
    .route('/bus/timetable_details')
    .post(handleGetBusTimetableDetailsFeatures)

router
    .route('/bus/pricelists')
    .get(handleGetBusPricelistsFeature)
    .post(handleUpsertBusPricelistFeature)
    .patch(handleUpsertBusPricelistFeature)

router
    .route('/bus/timetables/refresh_prices')
    .post(handleRefreshBusTimetablePricesFeature)

router
    .route('/bus/sales/routes')
    .get(handleGetBusSalesRoutesFeature)

router
    .route('/bus/sales/prices')
    .get(handleGetBusSalesPricesFeature)

router
    .route('/bus/bookings')
    .get(handleGetBusBookingsFeature)

router
    .route('/bus/bookings/init')
    .post(handleInitBusBookingsFeature)

router
    .route('/bus/bookings/reserve')
    .post(handleReserveBusBookingsFeature)

router
    .route('/bus/bookings/release')
    .post(handleReleaseBusBookingsFeature)

router
    .route('/bus/bookings/additional')
    .patch(handleSetBusAdditionalCapacityFeature)

router
    .route('/bus/bookings/validate')
    .post(handleValidateBusTicketsFeature)

router
    .route('/bus/bookings/seats')
    .get(handleGetBusSeatsFeature)

router
    .route('/bus/sailings')
    .get(handleGetBusSailingsFeature)

router
    .route('/bus/sailings/:uuid')
    .get(handleGetBusSailingDetailsFeature)

router
    .route('/bus/dispatcher/cancel_sailing')
    .post(handleCancelBusSailingFeature)

router
    .route('/bus/dispatcher/send_sailing_message')
    .post(handleSendBusSailingMessageFeature)

router
    .route('/bus/dispatcher/change_vehicle')
    .post(handleChangeBusVehicleFeature)

router
    .route('/bus/dispatcher/set_voyage_delay')
    .post(handleSetBusVoyageDelayFeature)

router
    .route('/bus/driver/set_status')
    .post(handleSetBusVoyageStatusFeature)

router
    .route('/bus/driving_plans')
    .get(handleGetBusDrivingPlansFeature)
    .post(handleUpsertBusDrivingPlanFeature)
    .patch(handleUpsertBusDrivingPlanFeature)

router
    .route('/bus/driving_plans/:uuid')
    .delete(handleDeleteBusDrivingPlanFeature)

router
    .route('/bus/driving_plans/:uuid/voyages')
    .get(handleGetBusPlanVoyagesFeature)

router
    .route('/bus/timetables/voyages_summary')
    .get(handleGetBusTimetableVoyagesSummaryFeature)

router
    .route('/bus/driving_plan_voyages')
    .get(handleGetBusPlanVoyagesByQueryFeature)

router
    .route('/bus/voyage_legs')
    .get(handleGetBusVoyageLegsFeature)

// Web POS cart prodaja + računi (/cancel i /:uuid redoslijed bitan)
router
    .route('/bus/finalize_cart_sale')
    .post(handleFinalizeBusCartSaleFeature)

router
    .route('/bus/invoices')
    .get(handleGetBusInvoicesFeature)

router
    .route('/bus/invoices/cancel')
    .post(handleCancelBusInvoiceFeature)

router
    .route('/bus/invoices/pdf')
    .get(handleGetBusInvoicePdfFeature)

router
    .route('/bus/invoices/:uuid')
    .get(handleGetBusInvoiceDetailFeature)

router
    .route('/bus/putni_radni_listovi')
    .get(handleGetBusPutniRadniListoviFeature)

router
    .route('/bus/putni_radni_listovi/izdaj')
    .post(handleIzdajBusPutniRadniListFeature)

router
    .route('/bus/putni_radni_listovi/prekini')
    .patch(handlePrekiniBusPutniRadniListFeature)

router
    .route('/bus/putni_radni_listovi/zavrsi')
    .patch(handleZavrsiBusPutniRadniListFeature)

router
    .route('/bus/putni_radni_listovi/otkazi')
    .patch(handleOtkaziBusPutniRadniListFeature)

router
    .route('/bus/putni_radni_listovi/pdf')
    .get(handleGetBusPutniRadniListPdfFeature)

router
    .route('/bus/putni_radni_listovi/:uuid')
    .get(handleGetBusPutniRadniListDetailFeature)

module.exports = router