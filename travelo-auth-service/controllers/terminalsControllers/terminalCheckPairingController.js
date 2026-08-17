const jwt = require('jsonwebtoken');
const { verifyTerminalPremise } = require('./terminalLoginController');

const TERMINALS_JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET";

/**
 * Zero-touch uparivanje po serijskom broju uređaja.
 *
 * Terminal koji još nema token pri pokretanju šalje svoj SN i saznaje kako se
 * uparuje:
 *   - mode 'auto'   → uređaj je aktivan I ima auto_pair → token se izdaje odmah,
 *                     bez unosa TID-a i OTP-a.
 *   - mode 'manual' → sve ostalo (nema zastavice, SN nije prepoznat, prostor
 *                     nije dozvoljen) → ide na ručno uparivanje. TID vraćamo
 *                     ako je SN prepoznat, da ekran može predpuniti polje.
 *
 * Token se izdaje samo uz trostruku provjeru: is_active, auto_pair i tip
 * poslovnog prostora (MOBIL/POSL) — ista provjera kao kod ručnog uparivanja,
 * da automatika ne zaobiđe pravilo koje vrijedi za TID/OTP.
 */
const terminalCheckPairingController = async (req, res) => {
    try {
        const { TerminalsModel } = req.app.locals.models;
        const { serial_number } = req.body || {};

        if (!serial_number) {
            return res.send({ status: 400, data: { msg: 'Nije poslan serijski broj (SN)' } });
        }

        const terminalData = await TerminalsModel.findOne({
            where: { serial_number, is_active: true },
        });

        const manual = (msg) => res.send({
            status: 200,
            data: {
                mode: 'manual',
                found: !!terminalData,
                tid: terminalData ? terminalData.tid : null,
                msg: msg || null,
            },
        });

        if (!terminalData || terminalData.auto_pair !== true) return manual();

        const check = await verifyTerminalPremise(terminalData.uuid);
        if (!check.ok) {
            console.log('terminalCheckPairing odbijen:', check.reason);
            return manual(check.reason);
        }

        const token = jwt.sign({ t: terminalData.uuid }, TERMINALS_JWT_SECRET, { expiresIn: '30d' });
        return res.send({
            status: 200,
            data: { mode: 'auto', token, tid: terminalData.tid },
        });
    } catch (error) {
        console.log('terminalCheckPairingController error:', error?.message || error);
        res.send({ status: 500, data: { msg: error.message } });
    }
};

module.exports = {
    terminalCheckPairingController,
};
