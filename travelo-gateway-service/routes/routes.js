const express = require('express');
const { gatewayController } = require('../controllers/gatewayController');
const router = express.Router();

// 4-segment first (more specific) — supports resources like
// /portal/transactions/invoice/:uuid or /portal/transactions/invoice_pdf/:uuid
router
    .route('/:servis/:module/:path/:subpath')
    .all(gatewayController)

router
    .route('/:servis/:module/:path')
    .all(gatewayController)

router
    .route('/:servis/:module')
    .all(gatewayController)

module.exports = router
