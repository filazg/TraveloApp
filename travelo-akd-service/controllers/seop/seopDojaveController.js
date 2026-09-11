const {
    dojaviProdajuOPK, dojaviProdajuPPK, dojaviCvikanje, ponistiCvikanje, dojaviIsplovljenje,
} = require('./seopDojave');
const { dojaviUtrosak } = require('../mosi/mosiDojave');

// HTTP omotač oko dojava. Pozivatelj je transactions servis; ovdje se samo
// prosljeđuje i greška pretvara u odgovor.
//
// Neuspjeh dojave NIJE greška servisa: red u outboxu mora znati je li dojava
// preskočena (prekidač ugašen), odbijena (SEOP je rekao zašto) ili je pala
// zbog mreže. Zato status ostaje 200, a ishod je u tijelu.
const omotac = (posao) => async (req, res) => {
    try {
        const podaci = req.body?.body || req.body || {};
        const ishod = await posao(podaci);
        res.json({ status: 200, data: ishod });
    } catch (error) {
        console.log('seop dojava error:', error?.message || error);
        res.json({ status: 200, data: { ok: false, greska: true, poruka: error.message } });
    }
};

module.exports = {
    dojaviProdajuOpkController: omotac(dojaviProdajuOPK),
    dojaviProdajuPpkController: omotac(dojaviProdajuPPK),
    dojaviCvikanjeController: omotac(dojaviCvikanje),
    ponistiCvikanjeController: omotac(ponistiCvikanje),
    dojaviIsplovljenjeController: omotac(dojaviIsplovljenje),
    mosiDojaviUtrosakController: omotac(dojaviUtrosak),
};
