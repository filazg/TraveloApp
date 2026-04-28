const express = require('express');
const { webPortalLoginController } = require('../controllers/webPortalControllers/webPortalLoginController');
const { checkWebPortalLoginController, checkMeController } = require('../controllers/webPortalControllers/checkWebPortalLoginController');
const { terminalLoginController } = require('../controllers/terminalsControllers/terminalLoginController');
const { checkTerminalLoginController } = require('../controllers/terminalsControllers/checkTerminalLoginController');
const {
    partnerPortalLoginController,
    partnerCheckLoginController,
    partnerMeController,
    partnerLogoutController,
} = require('../controllers/partnerPortalControllers/partnerPortalLoginController');
const router = express.Router();

//WEB ADMIN LOGIN

router
    .route('/login/me')
    .get(checkMeController)

router
    .route('/login/webPortalLogin')
    .post(webPortalLoginController)

router
    .route('/login/webPortalCheckLogin')
    .post(checkWebPortalLoginController)

//TERMINALS LOGIN

router
    .route('/login/terminalLogin')
    .post(terminalLoginController)

router
    .route('/login/terminalCheckLogin')
    .post(checkTerminalLoginController)

//PARTNER WEB LOGIN

router
    .route('/login/partnerLogin')
    .post(partnerPortalLoginController)

router
    .route('/login/partnerCheckLogin')
    .post(partnerCheckLoginController)

router
    .route('/login/partnerMe')
    .get(partnerMeController)

router
    .route('/login/partnerLogout')
    .post(partnerLogoutController)

module.exports = router