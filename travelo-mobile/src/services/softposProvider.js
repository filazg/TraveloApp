// SoftPOS provider (servisni izbornik). Isti 7pay kredencijali vrijede za
// aplikacije više banaka — razlikuje se samo paket aplikacije koja se poziva.
// Izbor je po uređaju (settings), jer na istom terminalu može biti instalirana
// samo aplikacija banke s kojom klijent ima ugovor.
//
// Bez izbora vrijedi paket iz konfiguracije (payment_7pay.package_name), a bez
// nje testna aplikacija — kao i dosad.
import { getSetting, setSetting } from '../db/db';

// Testna aplikacija traži testni OIB trgovca, neovisno o OIB-u klijenta.
export const TEST_MERCHANT_TAX_ID = '34855856319';

export const SOFTPOS_PROVIDERS = [
    { key: 'test', naziv: 'Test (7pay)', paket: 'com.sevenpay.tnp_test', merchantTaxId: TEST_MERCHANT_TAX_ID },
    { key: '7pay', naziv: '7Pay switching', paket: 'com.sevenpay.tnp_prod' },
    { key: 'gp_hr', naziv: 'Global Payments Croatia', paket: 'com.sevenpay.ecc.tnp' },
    { key: 'nexi_hr', naziv: 'Nexi Croatia', paket: 'com.sevenpay.nexi.tnp' },
    { key: 'nexi_ce', naziv: 'Nexi Central Europe', paket: 'com.sevenpay.nexice.tnp' },
    { key: 'otp', naziv: 'OTP banka', paket: 'com.sevenpay.otp.tnp' },
];

const KLJUC = 'softpos_provider';

export const providerPoKljucu = (key) => SOFTPOS_PROVIDERS.find((p) => p.key === key) || null;
export const providerPoPaketu = (paket) => SOFTPOS_PROVIDERS.find((p) => p.paket === paket) || null;

/** Odabrani provider na uređaju ili null (nije biran — vrijedi konfiguracija). */
export const ucitajSoftposProvider = async () => providerPoKljucu(await getSetting(KLJUC));

export const spremiSoftposProvider = (key) => setSetting(KLJUC, key || '');

// „Ispis za trgovca" — zaseban listić s podacima kartične naplate, nakon
// računa i karata. Po uređaju, zadano isključeno (kao na blagajni).
const KLJUC_LISTIC = 'merchant_slip';

export const ucitajIspisZaTrgovca = async () => (await getSetting(KLJUC_LISTIC)) === '1';

export const spremiIspisZaTrgovca = (ukljuceno) => setSetting(KLJUC_LISTIC, ukljuceno ? '1' : '0');
