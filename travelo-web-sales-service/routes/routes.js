const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { getHarborsDataController, getWebPageHarborsDataController } = require('../controllers/dataControllers/harborsControllers');
const { searchTripsController, searchWebPageTripsController } = require('../controllers/logicControllers.js/searcTripsControllers');
const { getBusinesPremisessData } = require('../controllers/logicControllers.js/getBusinesPremisessData');
const { getInfoData } = require('../controllers/logicControllers.js/getInfoData');
const { downloadWebPageApiDocumentation } = require('../controllers/downloadControllers');
const { createOrderConfirmationController, getOrdersByReferenceController } = require('../controllers/logicControllers.js/orderConfirmationController');
const { ticketsPdfProxyController } = require('../controllers/logicControllers.js/ticketsPdfProxyController');
const { monriWebhookController, simulatePaymentController } = require('../controllers/logicControllers.js/monriWebhookController');
const { invoicePdfProxyController } = require('../controllers/logicControllers.js/invoicePdfProxyController');
const { getCountriesController } = require('../controllers/dataControllers/countriesControllers');
const { checkIslandCardController } = require('../controllers/logicControllers.js/checkIslandCardController');
const router = express.Router();

const PARTNER_API_KEY = process.env.PARTNER_API_KEY;

const ALLOWED_ORIGINS = [
  'https://partner-domena.hr',
  'https://www.partner-domena.hr'
];

// ===== CORS =====
const partnerCors = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS not allowed'));
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
  credentials: false
});

// ===== RATE LIMIT =====
const partnerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Try again in a minute.'
  }
});

// ===== MIDDLEWARE =====
function validatePartnerApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
    console.log(apiKey)
    console.log(PARTNER_API_KEY)
  if (!apiKey || apiKey !== PARTNER_API_KEY) {
    return res.status(403).json({
      error: 'Unauthorized partner'
    });
  }

  next();
}

function validateSearchPayload(req, res, next) {
  const { travel_from_code, travel_to_code, travel_date } = req.body || {};

  if (
    typeof travel_from_code !== 'string' ||
    typeof travel_to_code !== 'string' ||
    typeof travel_date !== 'string'
  ) {
    return res.status(400).json({
      error: 'Invalid payload'
    });
  }

  if (!travel_from_code.trim() || !travel_to_code.trim()) {
    return res.status(400).json({
      error: 'travel_from_code and travel_to_code are required'
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(travel_date)) {
    return res.status(400).json({
      error: 'travel_date must be in YYYY-MM-DD format'
    });
  }

  next();
}

router
    .route('/harbors')
    .get(getHarborsDataController)

router
    .route('/countries')
    .get(getCountriesController)

router
    .route('/search_trips')
    .post(searchTripsController)

router
    .route('/order_confirmation')
    .post(createOrderConfirmationController)

router
    .route('/orders_by_reference')
    .get(getOrdersByReferenceController)

router
    .route('/tickets_pdf/:order_uuid')
    .get(ticketsPdfProxyController)

router
    .route('/monri_webhook')
    .post(monriWebhookController)

// Legacy alias — Monri panel je historijski konfiguriran na /monri_response
router
    .route('/monri_response')
    .post(monriWebhookController)

router
    .route('/simulate_payment')
    .post(simulatePaymentController)

router
    .route('/invoice_pdf/:invoice_uuid')
    .get(invoicePdfProxyController)


router
    .route('/web_page_harbors')
    .get(getWebPageHarborsDataController)

router
    .route('/web_page_search_trips')
    .post(searchWebPageTripsController)

router
    .route('/web_page_business_premises')
    .get(getBusinesPremisessData)

router
    .route('/web_page_info')
    .get(getInfoData)

router
    .route('/web_page_documentations')
    .get(downloadWebPageApiDocumentation)

router
    .route('/check_island_card')
    .post(checkIslandCardController)

router
  .route('/web_page_redirect')
  .post(
    partnerCors,
    partnerLimiter,
    validatePartnerApiKey,
    validateSearchPayload,
    (req, res) => {
      const { travel_from_code, travel_to_code, travel_date } = req.body;

      const redirectUrlpravi =
        `https://bookingtest/search` +
        `?from=${encodeURIComponent(travel_from_code)}` +
        `&to=${encodeURIComponent(travel_to_code)}` +
        `&date=${encodeURIComponent(travel_date)}` +
        `&partner=partner1`;

      const redirectUrl = 'https://index.hr'

      return res.json({ redirectUrl });
    }
  );


module.exports = router
