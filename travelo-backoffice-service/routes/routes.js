const express = require('express');
const { getCompanyDataController, updateCompanyDataController } = require('../controllers/dataControllers/companyDataControllers');
const { getBusinessPremisesDataController, addBusinessPremiseDataController, updateBusinessPremiseDataController } = require('../controllers/dataControllers/businessPremisesDataControllers');
const { getBillingDevicesController, addBillingDeviceController, updateBillingDeviceController } = require('../controllers/dataControllers/billingDevicesDataControllers');
const { getUsersDataController, addUserDataController, updateUserDataController } = require('../controllers/dataControllers/usersDataControllers');
const { getPartnersDataController, addPartnerDataController, updatePartnerDataController, getPartnersWebUsersDataController } = require('../controllers/dataControllers/partnersDataControllers');
const { getHolidaysDataController, addHolidayDataController, updateHolidayDataController } = require('../controllers/dataControllers/holidaysDataControllers');
const { getPaymentMethodsDataController, addPaymentMethodDataController, updatePaymentMethodDataController } = require('../controllers/dataControllers/paymentMethodsDataControllers');
const { getPaymentTypesDataController } = require('../controllers/dataControllers/paymentTypeDataControllers');
const { getAddressbookDataController, addAddressbookDataController, updateAddressbookDataController } = require('../controllers/dataControllers/addressbookDataControllers');
const { getCountriesDataController, addCountryDataController, updateCountryDataController } = require('../controllers/dataControllers/countriesDataControllers');
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
    .route('/holidays')
    .get(getHolidaysDataController)
    .post(addHolidayDataController)
    .patch(updateHolidayDataController)

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

module.exports = router