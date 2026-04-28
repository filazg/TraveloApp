const express = require('express');
const { getMainServicesConfig, getChannelServicesConfig, getCoreServicesConfig } = require('../controllers/configServiceControllers');
const { getDatabaseConfigController } = require('../controllers/databaseConfigServiceControllers');
const { getIntegrationsConfigController } = require('../controllers/integrationsConfigServiceControllers');
const { getActiveEnv } = require('../config/configResolver');
const router = express.Router();

router
    .route('/health')
    .get((_req, res) => res.send({ status: 200, env: getActiveEnv() }));

router
    .route('/main_services_config')
    .all(getMainServicesConfig)

router
    .route('/channel_services_config')
    .all(getChannelServicesConfig)

router
    .route('/core_services_config')
    .all(getCoreServicesConfig)

router
    .route('/database_services_config')
    .post(getDatabaseConfigController)

router
    .route('/integrations_config')
    .all(getIntegrationsConfigController)

module.exports = router