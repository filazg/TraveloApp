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
const { monriWebhookController, simulatePaymentController, monriBrowserRedirectController } = require('../controllers/logicControllers.js/monriWebhookController');
const { invoicePdfProxyController } = require('../controllers/logicControllers.js/invoicePdfProxyController');
const { getCountriesController } = require('../controllers/dataControllers/countriesControllers');
const { cancelRoutesBatchController, rescheduleRoutesBatchController } = require('../controllers/dataControllers/routesController');
const { checkIslandCardController } = require('../controllers/logicControllers.js/checkIslandCardController');
const router = express.Router();

// Kljucevi za web stranicu i partnere. Vise njih se odvaja zarezom, da svaki
// dobije svoj — zajednicki kljuc se ne moze povuci jednom korisniku bez da se
// sruse svi ostali.
const PARTNER_API_KEYS = String(process.env.PARTNER_API_KEY || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

if (!PARTNER_API_KEYS.length) {
  // Bez kljuca su web_page endpointi zatvoreni za sve. Bolje glasno nego da se
  // otkrije tek kad stranica ostane bez podataka.
  console.log('UPOZORENJE: PARTNER_API_KEY nije postavljen — /web_page_* endpointi odbijaju svaki zahtjev.');
}

// Adresa web prodaje na koju se posjetitelj salje s partnerove stranice.
const WEB_SALES_PUBLIC_URL = process.env.WEB_SALES_PUBLIC_URL || 'https://bookingtest.krilo.hr';

const ALLOWED_ORIGINS = String(process.env.PARTNER_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

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

// Per-IP global limiter for end-user web sales endpoints (search/order/checkout).
// Higher max than partner limiter because this is per browser session (real user clicks).
const webPublicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in a minute.' },
});

// PDF/proxy endpoints — slightly stricter (rendering is expensive).
const webPdfLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PDF requests. Try again in a minute.' },
});

// ===== MIDDLEWARE =====
// Kljuc se ne ispisuje u log — ondje ga vidi svatko tko cita log, a rotacija
// kljuca je puno skuplja od jedne poruke o gresci.
function validatePartnerApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing x-api-key header'
    });
  }

  if (!PARTNER_API_KEYS.includes(apiKey)) {
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

// Otkaz polaska iz dispatchera — poziva ga transactions servis s istog
// posluzitelja, nije dio javnog web API-ja.
router
    .route('/routes/cancel_batch')
    .patch(cancelRoutesBatchController)
router
    .route('/harbors')
    .get(webPublicLimiter, getHarborsDataController)

router
    .route('/routes/reschedule_batch')
    .patch(rescheduleRoutesBatchController)

router
    .route('/countries')
    .get(webPublicLimiter, getCountriesController)

router
    .route('/search_trips')
    .post(webPublicLimiter, searchTripsController)

router
    .route('/order_confirmation')
    .post(webPublicLimiter, createOrderConfirmationController)

router
    .route('/orders_by_reference')
    .get(webPublicLimiter, getOrdersByReferenceController)

router
    .route('/tickets_pdf/:order_uuid')
    .get(webPdfLimiter, ticketsPdfProxyController)

// Bulk: ?order_uuids=u1,u2,... → jedan PDF za "preuzmi sve karte" gumb.
router
    .route('/tickets_pdf')
    .get(webPdfLimiter, ticketsPdfProxyController)

// Monri webhooks — NO rate limiter; comes from fixed processor IPs and dropping
// a webhook means losing the payment confirmation.
router
    .route('/monri_webhook')
    .post(monriWebhookController)

router
    .route('/monri_response')
    .post(monriWebhookController)

// Monri panel je konfiguriran s URL-om /monricallback (jedna riječ); ostavljamo
// stara dva alias-a radi povratne kompatibilnosti.
// GET handler — Monri panel je konfiguriran s istim URL-om i za success i za
// fail browser redirect, pa preusmjeravamo na /download s query stringom.
// DownloadPage SPA čita `status` i prikazuje uspjeh ili "Payment failed".
router
    .route('/monricallback')
    .get(monriBrowserRedirectController)
    .post(monriWebhookController)

router
    .route('/simulate_payment')
    .post(webPublicLimiter, simulatePaymentController)

router
    .route('/invoice_pdf/:invoice_uuid')
    .get(webPdfLimiter, invoicePdfProxyController)


router
    .route('/web_page_harbors')
    .get(partnerLimiter, validatePartnerApiKey, getWebPageHarborsDataController)

router
    .route('/web_page_search_trips')
    .post(partnerLimiter, validatePartnerApiKey, searchWebPageTripsController)

router
    .route('/web_page_business_premises')
    .get(partnerLimiter, validatePartnerApiKey, getBusinesPremisessData)

router
    .route('/web_page_info')
    .get(partnerLimiter, validatePartnerApiKey, getInfoData)

router
    .route('/web_page_documentations')
    .get(partnerLimiter, validatePartnerApiKey, downloadWebPageApiDocumentation)

// Otvoreno namjerno: ovo zove nasa web prodaja iz preglednika, nije dio
// sucelja prema vanjskoj stranici.
router
    .route('/check_island_card')
    .post(webPublicLimiter, checkIslandCardController)

router
  .route('/web_page_redirect')
  .post(
    partnerCors,
    partnerLimiter,
    validatePartnerApiKey,
    validateSearchPayload,
    (req, res) => {
      const { travel_from_code, travel_to_code, travel_date } = req.body;

      // Web prodaja nema zasebnu stranicu pretrage — pretraga je pocetna, pa
      // parametri idu na korijen. Adresa dolazi iz okoline jer se test i
      // produkcija razlikuju.
      const url = new URL(WEB_SALES_PUBLIC_URL);
      url.searchParams.set('from', travel_from_code);
      url.searchParams.set('to', travel_to_code);
      url.searchParams.set('date', travel_date);
      // Oznaka posiljatelja je predmetak kljuca kojim je pozvano ("web_..." ->
      // "web"), da se u prodaji vidi odakle je posjetitelj dosao bez zasebnog
      // sifarnika.
      const oznaka = String(req.headers['x-api-key'] || '').split('_')[0];
      if (oznaka) url.searchParams.set('partner', oznaka);

      return res.json({ redirectUrl: url.toString() });
    }
  );


module.exports = router
