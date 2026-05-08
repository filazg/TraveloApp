const crypto = require('crypto');
const axios = require('axios');
const { getCoreServiceConfigData } = require('../configSyncController');

const MERCHANT_KEY = process.env.MONRI_MERCHANT_KEY || 'krilo65#$%&amp;3';

const computeDigest = (payload) => {
    const input =
        MERCHANT_KEY +
        (payload.order_number || '') +
        (payload.amount || '') +
        (payload.currency || '') +
        (payload.response_code || '');
    return crypto.createHash('sha512').update(input).digest('hex');
};

const isApprovedStatus = (p) => {
    const s = String(p.status || '').toLowerCase();
    const rc = String(p.response_code || '');
    return s === 'approved' || s === 'success' || rc === '0000';
};

// Shared finalization — used by both Monri webhook and the DEV simulator.
const runFinalization = async ({ paymentRef, approved, meta }) => {
    const coreConfig = await getCoreServiceConfigData();
    const salesUrl = coreConfig?.services?.sales?.url;
    const txUrl = coreConfig?.services?.transactions?.url;
    if (!salesUrl || !txUrl) {
        return { ok: false, reason: 'core_service_urls_missing' };
    }

    if (!approved) {
        await axios.post(
            `${salesUrl}/orders_status`,
            { payment_reference: paymentRef, status: 'declined', meta },
            { timeout: 8000, validateStatus: () => true }
        );
        return { ok: true, status: 'declined' };
    }

    const ordersResp = await axios.get(`${salesUrl}/orders`, {
        params: { payment_reference: paymentRef },
        validateStatus: () => true,
    });
    const rawOrders = ordersResp.data?.data?.orders || ordersResp.data?.orders || [];
    if (!rawOrders.length) return { ok: false, reason: 'no_orders_for_reference' };

    if (rawOrders.every((o) => o.status === 'paid' && o.invoice_uuid)) {
        return { ok: true, status: 'paid', invoice_uuid: rawOrders[0].invoice_uuid, already: true };
    }

    const buyer = rawOrders[0]?.buyer_data || {};

    const finalizeResp = await axios.post(
        `${txUrl}/finalize_web_sale`,
        {
            payment_reference: paymentRef,
            buyer,
            language: rawOrders[0]?.language || 'hr',
            monri_meta: meta,
            orders: rawOrders.map((o) => ({
                order_uuid: o.uuid,
                route_uuid: o.route_uuid,
                line_code: o.line_code,
                line_name: o.line_name,
                departure_date: o.departure_date,
                departure_time: o.departure_time,
                departure_harbor_code: o.departure_harbor_code,
                departure_harbor_name: o.departure_harbor_name,
                arrival_harbor_code: o.arrival_harbor_code,
                arrival_harbor_name: o.arrival_harbor_name,
                items: o.items || [],
            })),
        },
        { timeout: 20000, validateStatus: () => true }
    );

    if (finalizeResp.status !== 200) {
        return { ok: false, reason: 'finalize_failed', detail: finalizeResp.data };
    }

    const { invoice_uuid } = finalizeResp.data?.data || {};
    await axios.post(
        `${salesUrl}/orders_status`,
        { payment_reference: paymentRef, status: 'paid', meta, invoice_uuid },
        { timeout: 8000, validateStatus: () => true }
    );
    return { ok: true, status: 'paid', invoice_uuid };
};

const monriWebhookController = async (req, res) => {
    try {
        const payload = req.body || {};
        console.log('MONRI WEBHOOK payload:', payload);

        const expected = computeDigest(payload);
        const received = String(payload.digest || '').toLowerCase();
        const digestOk = Boolean(received) && received === expected;
        if (!digestOk) console.log('MONRI WEBHOOK digest mismatch', { expected, received });
        const approved = isApprovedStatus(payload);

        const meta = {
            response_code: payload.response_code,
            monri_status: payload.status,
            transaction_type: payload.transaction_type,
            amount: payload.amount,
            currency: payload.currency,
            digest_verified: digestOk,
            received_at: new Date().toISOString(),
        };

        // SIGURNOST: izdavanje karata + računa (approved) ide samo s validnim
        // digest-om. Decline (i sve ostalo) može proći — samo update statusa.
        if (approved && !digestOk) {
            console.log('MONRI WEBHOOK REJECTED (approved + digest mismatch)', {
                payment_reference: payload.order_number,
            });
            return res.status(200).send('rejected_invalid_digest');
        }

        await runFinalization({
            paymentRef: payload.order_number,
            approved,
            meta,
        });

        return res.status(200).send('ok');
    } catch (error) {
        console.log('monriWebhookController error:', error?.message || error);
        return res.status(200).send('error_logged');
    }
};

// DEV simulator — bypass Monri (localhost has no HTTPS). Body: { payment_reference, status? }
// SIGURNOST: dostupan samo ako je env ALLOW_PAYMENT_SIMULATOR=true. Inače 404.
// Razlog: bez gate-a bilo bi moguće sa public interneta approve-ati bilo koji
// order i dobiti karte besplatno.
const simulatePaymentController = async (req, res) => {
    if (String(process.env.ALLOW_PAYMENT_SIMULATOR || '').toLowerCase() !== 'true') {
        return res.status(404).send('Not found');
    }
    try {
        const { payment_reference, status = 'approved' } = req.body || {};
        if (!payment_reference) {
            return res.status(400).json({ status: 400, data: { message: 'payment_reference required' } });
        }
        const approved = String(status).toLowerCase() === 'approved';
        const meta = {
            simulated: true,
            monri_status: approved ? 'approved' : 'declined',
            response_code: approved ? '0000' : 'X999',
            received_at: new Date().toISOString(),
        };
        const result = await runFinalization({ paymentRef: payment_reference, approved, meta });
        return res.status(200).json({ status: 200, data: result });
    } catch (error) {
        console.log('simulatePaymentController error:', error?.message || error);
        return res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// Browser-redirect handler — Monri redirect-a kupca natrag s query stringom
// (`order_number`, `response_code`, `status`, `digest`, ...). Server-to-server
// webhook (`POST /monricallback`) ovisi o konfiguraciji u Monri panelu pa
// može zakazati; ovaj GET je pouzdaniji za UI flow.
//
// SIGURNOST: izdavanje karata + računa (approved put) ide ISKLJUČIVO ako HMAC
// digest validira. Inače bilo tko bi mogao kraftati URL s response_code=0000
// i dobiti karte besplatno. Decline put ne kreira ništa novo (samo status
// update na već postojećem orderu) pa se može izvesti i bez digest-a.
const monriBrowserRedirectController = async (req, res) => {
    try {
        const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        const q = req.query || {};
        const orderNumber = q.order_number || q.payment_reference || '';
        if (orderNumber) {
            const payload = {
                order_number: orderNumber,
                amount: q.amount,
                currency: q.currency,
                response_code: q.response_code,
                status: q.status,
                digest: q.digest,
            };
            const expected = computeDigest(payload);
            const received = String(payload.digest || '').toLowerCase();
            const digestOk = Boolean(received) && received === expected;
            const approved = isApprovedStatus(payload);
            const meta = {
                response_code: payload.response_code,
                monri_status: payload.status,
                amount: payload.amount,
                currency: payload.currency,
                digest_verified: digestOk,
                source: 'browser_redirect',
                received_at: new Date().toISOString(),
            };

            if (approved && !digestOk) {
                // Approved put bez validnog digest-a je sumnjiv — možda kupac
                // koji je tab pre-loadao sa starim parametrima, možda napad.
                // NE finaliziramo. Ostavljamo order na pending_payment; pravi
                // server-to-server webhook (kad Monri panel bude konfiguriran)
                // će ga ispravno obraditi. Logiramo za audit.
                console.log('monri browser-redirect REJECTED (approved status, digest mismatch)', {
                    orderNumber,
                    received_digest: received,
                    has_response_code: Boolean(q.response_code),
                });
            } else {
                try {
                    await runFinalization({
                        paymentRef: orderNumber,
                        approved,
                        meta,
                    });
                } catch (finErr) {
                    console.log('monri browser-redirect finalize error:', finErr?.message || finErr);
                }
            }
        }
        return res.redirect(302, `/download${qs}`);
    } catch (error) {
        console.log('monriBrowserRedirectController error:', error?.message || error);
        return res.redirect(302, '/download');
    }
};

module.exports = { monriWebhookController, simulatePaymentController, monriBrowserRedirectController };
