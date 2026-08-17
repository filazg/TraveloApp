const jwt = require('jsonwebtoken');
const axios = require('axios');
const { getCoreServiceConfigData } = require('../configSyncController');

const TERMINALS_JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET";

// Allowed premise types for terminal pairing (mobile + boat-desk PC POS).
const ALLOWED_PREMISE_TYPES = ['MOBIL', 'POSL'];

const verifyTerminalPremise = async (terminalUuid) => {
    try {
        const cfg = await getCoreServiceConfigData();
        const backofficeUrl = cfg?.services?.backoffice?.url;
        if (!backofficeUrl) return { ok: false, reason: 'backoffice URL missing' };
        const [bdResp, bpResp] = await Promise.all([
            axios.get(`${backofficeUrl}/billing_devices`, { timeout: 5000, validateStatus: () => true }),
            axios.get(`${backofficeUrl}/business_premises`, { timeout: 5000, validateStatus: () => true }),
        ]);
        const bds = bdResp.data?.data?.billing_devices || [];
        const bps = bpResp.data?.data?.business_premises || [];
        const bd = bds.find((x) => x.uuid === terminalUuid);
        if (!bd) return { ok: false, reason: 'Terminal nije registriran u sustavu (billing_devices).' };
        const bp = bps.find((x) => x.uuid === bd.business_premise_uuid);
        if (!bp) return { ok: false, reason: 'Poslovni prostor nije pronađen.' };
        const type = String(bp.type || '').toUpperCase();
        if (!ALLOWED_PREMISE_TYPES.includes(type)) {
            return { ok: false, reason: `Tip poslovnog prostora '${type || '—'}' nije dozvoljen za uparivanje terminala.` };
        }
        return { ok: true, premise: bp };
    } catch (e) {
        return { ok: false, reason: 'Provjera poslovnog prostora nije uspjela: ' + (e?.message || e) };
    }
};

const terminalLoginController = async (req, res) => {
    try {
        const { TerminalsModel } = req.app.locals.models;
        const { tid, otp } = req.body;
        if (!tid || !otp) {
            return res.send({ status: 400, data: { msg: 'Nisu uneseni svi potrebni podaci' } });
        }
        const terminalData = await TerminalsModel.findOne({ where: { tid, is_active: true } });
        // Original code had `||` which let any matching tid through — fixed to require BOTH.
        if (!terminalData || terminalData.otp !== otp) {
            return res.send({ status: 400, data: { msg: 'Terminal sa navedenim podacima ne postoji u sustavu ili nema prava na pristup' } });
        }
        // Allow pairing for both mobile (MOBIL) and desktop POS (POSL) premise types.
        const check = await verifyTerminalPremise(terminalData.uuid);
        if (!check.ok) {
            return res.send({ status: 403, data: { msg: check.reason } });
        }
        const token = jwt.sign({ t: terminalData.uuid }, TERMINALS_JWT_SECRET, { expiresIn: '30d' });
        return res.send({ status: 200, data: { msg: 'token je uspješno generiran', token } });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: error });
    }
};

module.exports = {
    terminalLoginController,
    // dijeli ga i zero-touch uparivanje, da automatika ne zaobiđe isto pravilo
    verifyTerminalPremise,
};