const express = require('express');
const { seopSignTestController } = require('../controllers/seop/seopSignController');
const { provjeriPPPController } = require('../controllers/seop/seopController');
const { uploadSeopCertController, seopCertInfoController, seopTestVezeController } = require('../controllers/seop/seopCertController');
const { uploadMosiCertController, mosiCertInfoController, mosiTestVezeController } = require('../controllers/mosi/mosiController');
const { dojaviProdajuOpkController, dojaviProdajuPpkController, dojaviCvikanjeController, ponistiCvikanjeController, dojaviIsplovljenjeController, mosiDojaviUtrosakController } = require('../controllers/seop/seopDojaveController');
const { provjeriPovlasticuController, otvoriPovlasticuController, katalogPravaController, popustiPravaController } = require('../controllers/povlastica/povlasticaController');

const router = express.Router();

router.get('/health', (_req, res) => {
    res.json({ status: 200, data: { service: 'travelo-akd-service', ok: true } });
});

router.post('/seop/sign-test', seopSignTestController);
router.post('/seop/provjeri-ppp', provjeriPPPController);

// Povlastica — jedini poziv koji prodajni kanali koriste. Ispod njega su i SEOP
// i MOSI, i pravila linije; blagajna dobiva gotovu odluku i zapecaceni zapis
// koji vraca uz prodaju. Sto dojava trazi, dodaje se u taj zapis ovdje, pa se
// klijenti zbog novih polja ne moraju mijenjati.
router.post('/povlastica/provjeri', provjeriPovlasticuController);
router.post('/povlastica/otvori', otvoriPovlasticuController);

// Popusti po pravu — kad se SEOP ne moze pitati, postotak dolazi odavde.
// `katalog` je za portal (sva prava, i bez upisanog popusta), `popusti` za
// uredaje (samo ukljuceni, s oznakom je li pravo rezidentsko).
router.get('/povlastica/katalog', katalogPravaController);
router.get('/povlastica/popusti', popustiPravaController);

// Administracija iz portala: ucitavanje certifikata, pregled onoga sto je na
// disku i provjera veze dijagnostickom metodom SEOP-a.
router.post('/seop/cert', uploadSeopCertController);
router.get('/seop/cert-info', seopCertInfoController);
router.post('/seop/test-veze', seopTestVezeController);

// MOSI (AKD) — dojava koristenja invalidskih povlastica.
router.post('/mosi/cert', uploadMosiCertController);
router.get('/mosi/cert-info', mosiCertInfoController);
router.post('/mosi/test-veze', mosiTestVezeController);

// Dojave. Zove ih transactions servis iz svog reda cekanja (outbox), pa svaki
// poziv vraca ishod u tijelu — i kad dojava nije prosla — da red zna sto dalje.
router.post('/seop/dojavi-prodaju-opk', dojaviProdajuOpkController);
router.post('/seop/dojavi-prodaju-ppk', dojaviProdajuPpkController);
router.post('/seop/dojavi-cvikanje', dojaviCvikanjeController);
router.post('/seop/ponisti-cvikanje', ponistiCvikanjeController);
router.post('/seop/dojavi-isplovljenje', dojaviIsplovljenjeController);
router.post('/mosi/dojavi-utrosak', mosiDojaviUtrosakController);

module.exports = router;
