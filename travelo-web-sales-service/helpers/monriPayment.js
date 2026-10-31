const crypto = require('crypto');
const axios = require('axios');

// Pokretanje Monri plaćanja sa servera. Stara web prodaja ovo radi u
// pregledniku, pa su merchant key i authenticity token u javnom bundleu, a
// iznos za digest računa sam kupac. Ovdje iznos dolazi iz narudžbi koje je
// izradio sales servis, a ključ ne napušta backend.
const FORM_URL = process.env.MONRI_FORM_URL || 'https://ipgtest.monri.com/v2/form';
const MERCHANT_KEY = process.env.MONRI_MERCHANT_KEY || 'krilo65#$%&amp;3';
const AUTHENTICITY_TOKEN = process.env.MONRI_AUTHENTICITY_TOKEN || 'cec50256766ed9ba50fc88d7787326494f3f06fe';

const sha512 = (input) => crypto.createHash('sha512').update(input).digest('hex');

// amountCents — cijeli broj u centima; vraća payment_url na koji se kupac šalje.
const initMonriPayment = async ({ order_number, amount_cents, language, success_url }) => {
    const order = {
        order_info: order_number,
        order_number,
        amount: amount_cents,
        currency: 'EUR',
        language: language === 'hr' ? 'hr' : 'en',
        transaction_type: 'purchase',
        authenticity_token: AUTHENTICITY_TOKEN,
        digest: sha512(MERCHANT_KEY + order_number + amount_cents + 'EUR'),
        success_url_override: success_url,
    };
    const resp = await axios.post(FORM_URL, order, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 15000,
        validateStatus: () => true,
    });
    if (resp.status >= 400 || !resp.data?.payment_url) {
        const detalj = JSON.stringify(resp.data || {}).slice(0, 300);
        throw new Error(`Monri form ${resp.status}: ${detalj}`);
    }
    return resp.data.payment_url;
};

module.exports = { initMonriPayment };
