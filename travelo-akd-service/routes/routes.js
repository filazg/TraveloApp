const express = require('express');
const { seopSignTestController } = require('../controllers/seop/seopSignController');
const { provjeriPPPController } = require('../controllers/seop/seopController');

const router = express.Router();

router.get('/health', (_req, res) => {
    res.json({ status: 200, data: { service: 'travelo-akd-service', ok: true } });
});

router.post('/seop/sign-test', seopSignTestController);
router.post('/seop/provjeri-ppp', provjeriPPPController);

module.exports = router;
