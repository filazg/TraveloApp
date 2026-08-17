const express = require('express');
const rateLimit = require('express-rate-limit');
const { webPortalLoginController } = require('../controllers/webPortalControllers/webPortalLoginController');
const { checkWebPortalLoginController, checkMeController } = require('../controllers/webPortalControllers/checkWebPortalLoginController');
const { terminalLoginController } = require('../controllers/terminalsControllers/terminalLoginController');
const { checkTerminalLoginController } = require('../controllers/terminalsControllers/checkTerminalLoginController');
const { terminalCheckPairingController } = require('../controllers/terminalsControllers/terminalCheckPairingController');
const {
    partnerPortalLoginController,
    partnerCheckLoginController,
    partnerMeController,
    partnerLogoutController,
} = require('../controllers/partnerPortalControllers/partnerPortalLoginController');
const { apiPartnerLoginController } = require('../controllers/apiPartnerControllers/apiPartnerLoginController');
const router = express.Router();

// Per-IP brute-force defense for all login endpoints.
const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Try again in a minute." },
});

// Light limiter for the "check session" endpoints (clients poll these).
const checkLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Try again in a minute." },
});

//WEB ADMIN LOGIN

router
    .route('/login/me')
    .get(checkLimiter, checkMeController)

router
    .route('/login/webPortalLogin')
    .post(loginLimiter, webPortalLoginController)

router
    .route('/login/webPortalCheckLogin')
    .post(checkLimiter, checkWebPortalLoginController)

//TERMINALS LOGIN

router
    .route('/login/terminalLogin')
    .post(loginLimiter, terminalLoginController)

router
    .route('/login/terminalCheckPairing')
    .post(loginLimiter, terminalCheckPairingController)

router
    .route('/login/terminalCheckLogin')
    .post(checkLimiter, checkTerminalLoginController)

//PARTNER WEB LOGIN

router
    .route('/login/partnerLogin')
    .post(loginLimiter, partnerPortalLoginController)

router
    .route('/login/partnerCheckLogin')
    .post(checkLimiter, partnerCheckLoginController)

router
    .route('/login/partnerMe')
    .get(checkLimiter, partnerMeController)

router
    .route('/login/partnerLogout')
    .post(partnerLogoutController)

//API PARTNER LOGIN

router
    .route('/login/apiPartnerLogin')
    .post(loginLimiter, apiPartnerLoginController)

module.exports = router