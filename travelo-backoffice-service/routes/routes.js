const express = require('express');
const { getCompanyDataController, updateCompanyDataController } = require('../controllers/dataControllers/companyDataControllers');
const { getBusinessPremisesDataController, addBusinessPremiseDataController, updateBusinessPremiseDataController } = require('../controllers/dataControllers/businessPremisesDataControllers');
const { getBillingDevicesController, addBillingDeviceController, updateBillingDeviceController, generateBillingDeviceTidController, generateBillingDeviceOtpController } = require('../controllers/dataControllers/billingDevicesDataControllers');
const { getDeviceModelsDataController, getDeviceSerialNumbersDataController } = require('../controllers/dataControllers/deviceSerialNumbersDataControllers');
const { getChannelSettingsDataController, getChannelSettingDataController, upsertChannelSettingDataController } = require('../controllers/dataControllers/channelSettingsDataControllers');
const { getUsersDataController, addUserDataController, updateUserDataController } = require('../controllers/dataControllers/usersDataControllers');
const { getPartnersDataController, addPartnerDataController, updatePartnerDataController, getPartnersWebUsersDataController, getPartnersAPIUsersDataController } = require('../controllers/dataControllers/partnersDataControllers');
const { getHolidaysDataController, addHolidayDataController, updateHolidayDataController } = require('../controllers/dataControllers/holidaysDataControllers');
const { getStornoPercentagesDataController, addStornoPercentageDataController, updateStornoPercentageDataController } = require('../controllers/dataControllers/stornoPercentagesDataControllers');
const { getPaymentMethodsDataController, addPaymentMethodDataController, updatePaymentMethodDataController } = require('../controllers/dataControllers/paymentMethodsDataControllers');
const { getPaymentTypesDataController } = require('../controllers/dataControllers/paymentTypeDataControllers');
const { getAddressbookDataController, addAddressbookDataController, updateAddressbookDataController } = require('../controllers/dataControllers/addressbookDataControllers');
const { getCountriesDataController, addCountryDataController, updateCountryDataController } = require('../controllers/dataControllers/countriesDataControllers');
const { getAccountsDataController, addAccountDataController, updateAccountDataController, getAccountMappingsDataController, upsertAccountMappingDataController } = require('../controllers/dataControllers/accountsDataControllers');
const router = express.Router();

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