/**
 * Kartično plaćanje preko 7pay SoftPOS-a na terminalu.
 *
 * Tok: Firebase login (idToken) → složi se 7pay zahtjev → nativni modul pošalje
 * intent na 7pay aplikaciju i pričeka rezultat → responseCode 0 znači odobreno.
 * Sve što 7pay treba (kredencijali, partner, paket aplikacije) stiže s backenda
 * u `basicData.payment_7pay` — ništa se ne drži u kodu.
 */
import axios from 'axios';
import { NativeModules } from 'react-native';

const { SevenPay } = NativeModules;

// Testna aplikacija je zadana; produkcijska se traži kroz konfiguraciju.
const DEFAULT_PACKAGE = 'com.sevenpay.tnp_test';

export const CARD_RESPONSE_MESSAGES = {
    0: 'Transakcija je uspješna.',
    103: 'Potrebna je autorizacija putem poziva.',
    104: 'Opće odbijanje bez detalja.',
    105: 'Kartica nije podržana.',
    106: 'Transakcija nije podržana.',
    107: 'Kartica je istekla.',
    108: 'Prekoračen broj pokušaja unosa PIN-a.',
    109: 'Pogrešan PIN.',
    110: 'Kartica je blokirana.',
    111: 'Kartica prijavljena kao izgubljena.',
    112: 'Kartica prijavljena kao ukradena.',
    902: 'Greška u komunikaciji.',
    903: 'Neispravan format poruke.',
    904: 'Korisnik je prekinuo transakciju.',
    905: 'Neuspjela provjera idToken-a.',
    906: 'Sigurnosna provjera nije prošla.',
    907: 'NFC nije omogućen.',
    908: 'Neispravni podaci o trgovcu.',
    909: 'Prekoračen broj pokušaja provjere idToken-a. Potrebna je ručna reaktivacija.',
    910: 'Greška u hash validaciji.',
    911: 'Potrebna je nadogradnja aplikacije.',
};

export function cardResponseMessage(code) {
    return CARD_RESPONSE_MESSAGES[code] || `Nepoznata greška (${code})`;
}

// 7pay tip transakcije: 1 = prodaja, 3 = povrat/storno.
export const TX_SALE = 1;
export const TX_REFUND = 3;

const softPosPackage = (cfg) => cfg?.package_name || DEFAULT_PACKAGE;

/** Firebase idToken za 7pay — kratkotrajan, dobavlja se pri svakom plaćanju. */
async function getFirebaseIdToken(cfg) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.api_key}`;
    const res = await axios.post(url, {
        email: cfg.email,
        password: cfg.password,
        returnSecureToken: true,
    }, { timeout: 15000 });
    return res.data?.idToken;
}

/** 7pay timestamp: "yyyy-MM-dd HH:mm:ss,SSS". */
function softposTimestamp(date) {
    const d = date || new Date();
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())},${pad(d.getMilliseconds(), 3)}`
    );
}

/** Je li 7pay aplikacija instalirana na uređaju. */
export async function isCardPaymentAvailable(paymentCfg) {
    if (!SevenPay?.isAvailable) return false;
    try {
        return await SevenPay.isAvailable(softPosPackage(paymentCfg));
    } catch (e) {
        return false;
    }
}

/**
 * Pokreni kartično plaćanje.
 *   { ok:true, details }        — odobreno (responseCode 0)
 *   { ok:false, code, message } — odbijeno ili greška
 *
 * @param amount        iznos u eurima (npr. 3.50)
 * @param paymentCfg    basicData.payment_7pay
 * @param merchantTaxID OIB trgovca
 */
export async function payByCard({
    amount,
    paymentCfg,
    merchantTaxID,
    transactionType = TX_SALE,
    sequenceNumber = Date.now() % 100000,
    guid = '',
}) {
    if (!SevenPay?.startPayment) {
        return { ok: false, code: null, message: 'Kartično plaćanje nije dostupno u ovoj verziji aplikacije.' };
    }
    if (!paymentCfg?.api_key) {
        return { ok: false, code: null, message: 'Nedostaje 7pay konfiguracija (payment_7pay).' };
    }

    let idToken;
    try {
        idToken = await getFirebaseIdToken(paymentCfg);
    } catch (e) {
        return { ok: false, code: 905, message: 'Prijava na 7pay nije uspjela.' };
    }
    if (!idToken) {
        return { ok: false, code: 905, message: 'Nije dobiven 7pay token.' };
    }

    const request = {
        partnerID: paymentCfg.partner_id || paymentCfg.partenr_id,
        merchantTaxID: String(merchantTaxID || ''),
        senderAppID: paymentCfg.sender_app_id,
        version: paymentCfg.version || '2.1',
        ecrID: paymentCfg.ecr_id || 1234,
        sequenceNumber,
        transactionType,
        // 7pay očekuje iznos u najmanjoj jedinici valute (centima).
        transactionAmount: Math.round(Number(amount) * 100),
        amountCurrency: 978,
        timestamp: softposTimestamp(),
        idToken,
        additionalData: { guid: guid || '' },
    };

    let result;
    try {
        const raw = await SevenPay.startPayment(softPosPackage(paymentCfg), JSON.stringify(request));
        result = JSON.parse(raw);
    } catch (e) {
        // Nativni reject nosi JSON string u messageu kad ga 7pay vrati.
        let parsed = null;
        try {
            parsed = JSON.parse(e?.message);
        } catch (_) {}
        if (parsed) {
            result = parsed;
        } else {
            return { ok: false, code: null, message: e?.message || 'Kartično plaćanje nije uspjelo.' };
        }
    }

    const code = result?.additionalData?.responseCode ?? result?.responseCode;
    if (code === 0) {
        return { ok: true, details: result };
    }
    return { ok: false, code, message: cardResponseMessage(code), details: result };
}
