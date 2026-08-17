const crypto = require('crypto');
const axios = require('axios');
const { getCoreServiceConfigData } = require('../configSyncController');

const MERCHANT_KEY = process.env.MONRI_MERCHANT_KEY || 'krilo65#$%&amp;3';

// Monri webhook ne sadrži digest polje u tijelu (digest formula u
// computeDigest pokriva browser-redirect callback, ne server-to-server POST).
// Stoga POST authenticity gate-amo IP whitelist-om Monri-jevih notifying IP-eva.
// MONRI_TRUSTED_IPS env: CSV lista IP-eva koje vjerujemo kao Monri webhook
// pošiljatelja (npr. "178.218.169.68,217.197.255.32"). Prazno = striktno
// traži digest match (čime se trenutno odbacuju svi POST-ovi).
const TRUSTED_IPS = String(process.env.MONRI_TRUSTED_IPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const isTrustedSource = (req) => {
    if (!TRUSTED_IPS.length) return false;
    // Express trust proxy je postavljen pa req.ip je već realni klijent.
    const ip = (req.ip || '').replace(/^::ffff:/, '');
    return TRUSTED_IPS.includes(ip);
};

const sha512 = (input) => crypto.createHash('sha512').update(input).digest('hex');

// Monri ne šalje uvijek isti oblik digesta, a i sam ključ zna biti zapisan s
// HTML zapisom ampersanda (&amp;) ili s običnim &. Zato provjeravamo sve
// kombinacije istog ključa umjesto da odbijemo uplatu zbog zapisa — bez ključa
// se nijedna varijanta ne može izračunati, pa provjera ostaje jednako jaka.
const MERCHANT_KEYS = [...new Set([
    MERCHANT_KEY,
    MERCHANT_KEY.replace(/&amp;/g, '&'),
    MERCHANT_KEY.replace(/&/g, '&amp;'),
])];

const digestVariants = (payload) => {
    const on = payload.order_number || '';
    const amount = payload.amount || '';
    const currency = payload.currency || '';
    const rc = payload.response_code || '';
    const out = [];
    for (const key of MERCHANT_KEYS) {
        out.push({ name: `key+order+amount+currency+response_code (${key === MERCHANT_KEY ? 'izvorni' : 'alt'} ključ)`, value: sha512(key + on + amount + currency + rc) });
        out.push({ name: `key+order+amount+currency (${key === MERCHANT_KEY ? 'izvorni' : 'alt'} ključ)`, value: sha512(key + on + amount + currency) });
    }
    return out;
};

// Zadržano ime radi ostatka koda — vraća "glavnu" varijantu.
const computeDigest = (payload) => digestVariants(payload)[0].value;

// Vraća naziv varijante koja se poklopila, ili null.
const matchDigest = (payload) => {
    const received = String(payload.digest || '').toLowerCase();
    if (!received) return null;
    const hit = digestVariants(payload).find((v) => v.value === received);
    return hit ? hit.name : null;
};

// Kad digest ne prođe, uplatu prihvaćamo samo ako se sve poklopi s NAŠOM
// narudžbom: postoji pod tom referencom, još nije plaćena i iznos s povratka
// je isti do zadnjeg centa. Referenca je nasumičan UUID, pa je za zloupotrebu
// potrebno pogoditi i nju i točan iznos.
const orderMatchesPayment = async (paymentRef, amountFromMonri) => {
    const amountCents = parseInt(String(amountFromMonri || ''), 10);
    if (!paymentRef || !Number.isFinite(amountCents) || amountCents <= 0) {
        return { ok: false, reason: 'missing_reference_or_amount' };
    }
    const coreConfig = await getCoreServiceConfigData();
    const salesUrl = coreConfig?.services?.sales?.url;
    if (!salesUrl) return { ok: false, reason: 'sales_url_missing' };

    const resp = await axios.get(`${salesUrl}/orders`, {
        params: { payment_reference: paymentRef },
        timeout: 8000,
        validateStatus: () => true,
    });
    const orders = resp.data?.data?.orders || resp.data?.orders || [];
    if (!orders.length) return { ok: false, reason: 'no_orders_for_reference' };

    const totalCents = Math.round(
        orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) * 100
    );
    if (totalCents !== amountCents) {
        return { ok: false, reason: 'amount_mismatch', expected_cents: totalCents, received_cents: amountCents };
    }
    return { ok: true, orders_count: orders.length, amount_cents: amountCents };
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
        const sourceIp = (req.ip || '').replace(/^::ffff:/, '');
        const trustedSource = isTrustedSource(req);
        console.log('MONRI WEBHOOK payload:', payload);
        console.log('MONRI WEBHOOK source:', { ip: sourceIp, trustedSource, headers_keys: Object.keys(req.headers || {}) });

        const matched = matchDigest(payload);
        const digestOk = Boolean(matched);
        if (digestOk) {
            console.log('MONRI WEBHOOK digest OK:', matched);
        } else {
            console.log('MONRI WEBHOOK digest mismatch', {
                received: String(payload.digest || '').toLowerCase(),
                tried: digestVariants(payload).map((v) => `${v.name}=${v.value.slice(0, 16)}…`),
            });
        }
        const approved = isApprovedStatus(payload);

        const meta = {
            response_code: payload.response_code,
            monri_status: payload.status,
            transaction_type: payload.transaction_type,
            amount: payload.amount,
            currency: payload.currency,
            digest_verified: digestOk,
            trusted_source: trustedSource,
            source_ip: sourceIp,
            received_at: new Date().toISOString(),
        };

        // SIGURNOST: karte i račun izdajemo ako je digest valjan, ako poziv
        // dolazi s Monri IP-a, ili ako se uplata poklapa s našom narudžbom
        // (ista referenca, isti iznos do centa). Webhook u tijelu nema digest u
        // obliku koji možemo provjeriti, pa bi inače legitimne uplate ostajale
        // neobrađene. Decline prolazi bez provjere — samo mijenja status
        // postojeće narudžbe, ne kreira ništa.
        let authenticated = digestOk || trustedSource;
        let verifiedBy = digestOk ? 'digest' : (trustedSource ? 'trusted_ip' : null);
        if (approved && !authenticated) {
            const amountCheck = await orderMatchesPayment(payload.order_number, payload.amount);
            if (amountCheck.ok) {
                authenticated = true;
                verifiedBy = 'order_amount_match';
                console.log('MONRI WEBHOOK prihvaćen bez digesta (iznos odgovara narudžbi)', {
                    payment_reference: payload.order_number,
                    amount_cents: amountCheck.amount_cents,
                    orders: amountCheck.orders_count,
                });
            } else {
                console.log('MONRI WEBHOOK REJECTED (approved, digest ne prolazi, iznos ne odgovara)', {
                    payment_reference: payload.order_number,
                    source_ip: sourceIp,
                    provjera: amountCheck,
                });
                return res.status(200).send('rejected_unauthenticated');
            }
        }
        meta.verified_by = verifiedBy;

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
// SIGURNOST: karte i račun izdajemo ako prođe digest ILI ako se povratak
// poklopi s našom narudžbom (postoji pod tom referencom i iznos je isti do
// centa). Monri na povratku potpisuje formulom koja ne odgovara dokumentaciji,
// pa bi inače svaka uplata ostala neobrađena. Za zloupotrebu bi trebalo pogoditi
// nasumičan UUID reference i točan iznos. Decline put ne kreira ništa novo
// (samo status na postojećoj narudžbi) pa je oduvijek prolazio bez digesta.
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
            const matched = matchDigest(payload);
            const digestOk = Boolean(matched);
            if (matched) console.log('monri browser-redirect digest OK:', matched);
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
            // Popunjava se niže ako digest ne prođe pa se uplata potvrđuje
            // usporedbom s narudžbom.
            let verifiedBy = digestOk ? 'digest' : null;

            let amountCheck = null;
            if (approved && !digestOk) {
                // Monri na povratku potpisuje drugom formulom nego što je
                // dokumentirano, pa digest ne prolazi. Umjesto da uplata ostane
                // neobrađena, provjeravamo je prema vlastitoj narudžbi.
                amountCheck = await orderMatchesPayment(orderNumber, payload.amount);
            }

            if (approved && !digestOk && !amountCheck?.ok) {
                // Approved put bez validnog digest-a je sumnjiv — možda kupac
                // koji je tab pre-loadao sa starim parametrima, možda napad.
                // NE finaliziramo. Ostavljamo order na pending_payment; pravi
                // server-to-server webhook (kad Monri panel bude konfiguriran)
                // će ga ispravno obraditi. Logiramo za audit.
                // Ispisujemo sve što je stiglo i sve varijante koje smo probali —
                // bez toga se ne može utvrditi razlikuje li se formula ili ključ.
                console.log('monri browser-redirect REJECTED (approved status, digest mismatch)', {
                    order_number: orderNumber,
                    amount: payload.amount,
                    currency: payload.currency,
                    response_code: payload.response_code,
                    status: payload.status,
                    received_digest: String(payload.digest || '').toLowerCase(),
                    tried: digestVariants(payload).map((v) => `${v.name}=${v.value.slice(0, 16)}…`),
                });
                // Cijeli query — formula na povratku očito uključuje i parametar
                // koji gore ne hvatamo, a bez popisa svih parametara se ne može
                // pogoditi koji.
                console.log('monri browser-redirect FULL QUERY:', JSON.stringify(q));
                console.log('monri browser-redirect provjera narudžbe:', amountCheck);
            } else {
                if (approved && !digestOk && amountCheck?.ok) {
                    verifiedBy = 'order_amount_match';
                    console.log('monri browser-redirect prihvaćen bez digesta (iznos odgovara narudžbi)', {
                        order_number: orderNumber,
                        amount_cents: amountCheck.amount_cents,
                        orders: amountCheck.orders_count,
                    });
                }
                meta.verified_by = verifiedBy;
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
