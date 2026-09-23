const express = require('express');
const { getCompanyDataController, updateCompanyDataController } = require('../controllers/dataControllers/companyDataControllers');
const { getBusinessPremisesDataController, addBusinessPremiseDataController, updateBusinessPremiseDataController } = require('../controllers/dataControllers/businessPremisesDataControllers');
const { getBillingDevicesController, addBillingDeviceController, updateBillingDeviceController, generateBillingDeviceTidController, generateBillingDeviceOtpController } = require('../controllers/dataControllers/billingDevicesDataControllers');
const { getDeviceModelsDataController, getDeviceSerialNumbersDataController } = require('../controllers/dataControllers/deviceSerialNumbersDataControllers');
const { getChannelSettingsDataController, getChannelSettingDataController, upsertChannelSettingDataController } = require('../controllers/dataControllers/channelSettingsDataControllers');
const { getUsersDataController, addUserDataController, updateUserDataController, changeUserPasswordDataController } = require('../controllers/dataControllers/usersDataControllers');
const { getPartnersDataController, addPartnerDataController, updatePartnerDataController, getPartnersWebUsersDataController, getPartnersAPIUsersDataController } = require('../controllers/dataControllers/partnersDataControllers');
const { getHolidaysDataController, addHolidayDataController, updateHolidayDataController } = require('../controllers/dataControllers/holidaysDataControllers');
const { getStornoPercentagesDataController, addStornoPercentageDataController, updateStornoPercentageDataController } = require('../controllers/dataControllers/stornoPercentagesDataControllers');
const { getWebNoticesDataController, getActiveWebNoticesDataController, addWebNoticeDataController, updateWebNoticeDataController } = require('../controllers/dataControllers/webNoticesDataControllers');
const { getPaymentMethodsDataController, addPaymentMethodDataController, updatePaymentMethodDataController } = require('../controllers/dataControllers/paymentMethodsDataControllers');
const { getPaymentTypesDataController } = require('../controllers/dataControllers/paymentTypeDataControllers');
const { getAddressbookDataController, addAddressbookDataController, updateAddressbookDataController, upsertAddressbookDataController } = require('../controllers/dataControllers/addressbookDataControllers');
const { getSudregLookupController } = require('../controllers/integrations/sudregController');
const { getSeyforCodebookController } = require('../controllers/integrations/seyforCodebooksController');
const { getCountriesDataController, addCountryDataController, updateCountryDataController } = require('../controllers/dataControllers/countriesDataControllers');
const { getAccountsDataController, addAccountDataController, updateAccountDataController, getAccountMappingsDataController, upsertAccountMappingDataController } = require('../controllers/dataControllers/accountsDataControllers');
const { javiIzmjenuOsnovnihPodataka } = require('../helpers/syncSignal');
const router = express.Router();

// Sifarnici koje uredaji nose u osnovnim podacima. Svaka izmjena javi se
// uredajima, jer kanal prema terminalima slozeni sifarnik drzi u memoriji
// minutu — bez signala bi novi operater ili drukciji postotak storna dotad bili
// nevidljivi koliko god puta blagajnik pritisnuo osvjezavanje.
//
// Samo GET prolazi bez javljanja. Put se poklapa i s podrutama, pa je promjena
// lozinke (/users/password) pokrivena — uredaj lozinke drzi lokalno, pa bi bez
// osvjezavanja prijava jos radila starom.
router.use(
    ['/company', '/business_premises', '/billing_devices', '/users', '/payment_methods', '/storno_percentages'],
    javiIzmjenuOsnovnihPodataka
);

router
    .route('/company')
    .get(getCompanyDataController)
    .patch(updateCompanyDataController)

router
    .route('/business_premises')
    .get(getBusinessPremisesDataController)
    .post(addBusinessPremiseDataController)
    .patch(updateBusinessPremiseDataController)

router
    .route('/billing_devices')
    .get(getBillingDevicesController)
    .post(addBillingDeviceController)
    .patch(updateBillingDeviceController)

router
    .route('/billing_devices/next_tid')
    .get(generateBillingDeviceTidController)

router
    .route('/billing_devices/next_otp')
    .get(generateBillingDeviceOtpController)

router
    .route('/device_models')
    .get(getDeviceModelsDataController)

router
    .route('/device_serial_numbers')
    .get(getDeviceSerialNumbersDataController)

router
    .route('/channel_settings')
    .get(getChannelSettingsDataController)

router
    .route('/channel_settings/:channel')
    .get(getChannelSettingDataController)
    .patch(upsertChannelSettingDataController)

router
    .route('/users')
    .get(getUsersDataController)
    .post(addUserDataController)
    .patch(updateUserDataController)

// Promjena vlastite lozinke — poziva ga auth-service (servis-servis), pa cita
// obican `req.body`, ne gateway wrap.
router
    .route('/users/password')
    .post(changeUserPasswordDataController)

router
    .route('/partners')
    .get(getPartnersDataController)
    .post(addPartnerDataController)
    .patch(updatePartnerDataController)

router
    .route('/partners_web_users')
    .get(getPartnersWebUsersDataController)

router
    .route('/partners_api_users')
    .get(getPartnersAPIUsersDataController)

router
    .route('/holidays')
    .get(getHolidaysDataController)
    .post(addHolidayDataController)
    .patch(updateHolidayDataController)

router
    .route('/web_notices')
    .get(getWebNoticesDataController)
    .post(addWebNoticeDataController)
    .patch(updateWebNoticeDataController)

// Samo one koje se trenutno prikazuju — cita ih web-sales za stranicu.
router
    .route('/web_notices/active')
    .get(getActiveWebNoticesDataController)

router
    .route('/storno_percentages')
    .get(getStornoPercentagesDataController)
    .post(addStornoPercentageDataController)
    .patch(updateStornoPercentageDataController)

router
    .route('/payment_methods')
    .get(getPaymentMethodsDataController)
    .post(addPaymentMethodDataController)
    .patch(updatePaymentMethodDataController)

router
    .route('/payment_types')
    .get(getPaymentTypesDataController)

router
    .route('/addressbook')
    .get(getAddressbookDataController)
    .post(addAddressbookDataController)
    .patch(updateAddressbookDataController)

// Write-through sa svih kanala — idempotentni upsert po OIB-u.
router
    .route('/addressbook/upsert')
    .post(upsertAddressbookDataController)

// Provjera OIB-a u Sudskom registru (auto-popuna kupca). Dijeli je cijeli
// sustav preko gatewaya svakog kanala; portal je zove direktno.
// Sifarnici analitike iz SAOP-a — citaju se uzivo, za izbor u portalu.
router
    .route('/seyfor_codebook')
    .get(getSeyforCodebookController)

router
    .route('/sudreg')
    .get(getSudregLookupController)

router
    .route('/countries')
    .get(getCountriesDataController)
    .post(addCountryDataController)
    .patch(updateCountryDataController)

router
    .route('/accounts')
    .get(getAccountsDataController)
    .post(addAccountDataController)
    .patch(updateAccountDataController)

router
    .route('/account_mappings')
    .get(getAccountMappingsDataController)
    .post(upsertAccountMappingDataController)

module.exports = router