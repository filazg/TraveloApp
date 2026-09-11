const express = require('express');
const { seopSignTestController } = require('../controllers/seop/seopSignController');
const { provjeriPPPController } = require('../controllers/seop/seopController');
const { uploadSeopCertController, seopCertInfoController, seopTestVezeController } = require('../controllers/seop/seopCertController');

const router = express.Router();

router.get('/health', (_req, res) => {
    res.json({ status: 200, data: { service: 'travelo-akd-service', ok: true } });
});

router.post('/seop/sign-test', seopSignTestController);
router.post('/seop/provjeri-ppp', provjeriPPPController);

// Administracija iz portala: ucitavanje certifikata, pregled onoga sto je na
// disku i provjera veze dijagnostickom metodom SEOP-a.
router.post('/seop/cert', uploadSeopCertController);
router.get('/seop/cert-info', seopCertInfoController);
router.post('/seop/test-veze', seopTestVezeController);

module.exports = router;
