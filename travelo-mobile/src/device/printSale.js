// Termalni ispis na Sunmi V2s.
// Sav layout (font, alignment, kolone, QR, cut) je u nativnom Kotlin sloju
// (`SunmiPrinterModule.printReceipt` / `printShiftReport` / `printTickets`).
// JS samo pakira podatke u ReadableMap i poziva native bridge.

import {
    nativePrintReceipt,
    nativePrintShiftReport,
    nativePrintTickets,
    sunmiPrinterAvailable,
} from './printer';

// Kartični blok na računu (kao boat-desk „KARTIČNO TEREĆENJE / CARD PAYMENT").
// Izvor je 7pay odgovor koji putuje uz prodaju kao payment_data — u odgovoru
// finalize_sale je u _localPayload, a kod kopije iz lokalne baze može biti i
// na vrhu. Bez odobrenja (responseCode 0) blok se ne ispisuje.
//
// 7pay timestamp: "yyyy-MM-dd HH:mm:ss,SSS" → "dd.MM.yyyy. HH:mm:ss".
function karticnoTerecenje(r) {
    let pd = r?.payment_data ?? r?._localPayload?.payment_data ?? null;
    if (typeof pd === 'string') {
        try { pd = JSON.parse(pd); } catch { pd = null; }
    }
    if (!pd) return null;
    const ad = pd.additionalData || {};
    const kod = ad.responseCode ?? pd.responseCode;
    if (kod !== 0 && kod !== '0') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(String(pd.timestamp || ''));
    return {
        tid: String(ad.terminalID || ''),
        mid: String(ad.merchantID || ''),
        aid: String(ad.aid || ''),
        datum: m ? `${m[3]}.${m[2]}.${m[1]}. ${m[4]}` : '',
        kartica: String(ad.cardApplicationName || ad.cardType || ''),
        brojKartice: String(ad.cardNumber || ''),
        odobrenje: String(ad.authorizationCode || ''),
        rrn: String(ad.rrn || ''),
        iznos: Number(pd.transactionAmount || 0) / 100,
    };
}

// Strukturirani POS račun.
// args:
//   r            — invoice response (invoice_no, invoice_year, invoice_code, totals…)
//   items        — [{ ticket_type_name, qty, unit_price, route: {...} }]
//   paymentName  — string (npr. "Gotovina")
//   basicData    — sync.basicData (client_*, business_premise_*, billing_device_*)
//   operator     — { user_name, user_surname }
//   voyage       — { line_code, first_departure_time }
//   fromHarbor   — { name }
//   toHarbor     — { name }
//   isReprint    — true → "*** KOPIJA ***" header
export async function printReceipt({ r, items, paymentName, basicData, operator, voyage, fromHarbor, toHarbor, isReprint }) {
    if (!sunmiPrinterAvailable) return true;
    try {
        // Backend response može imati alternativne ključeve (vat_base, vat,
        // harbor_tax, amount); native očekuje total_*. Normaliziraj prije slanja.
        const src = r || {};
        const invoice = {
            ...src,
            total_amount: Number(src.total_amount ?? src.amount ?? 0) || 0,
            total_vat_base: Number(src.total_vat_base ?? src.vat_base ?? 0) || 0,
            total_vat: Number(src.total_vat ?? src.vat ?? 0) || 0,
            total_harbor_tax: Number(src.total_harbor_tax ?? src.harbor_tax ?? 0) || 0,
        };
        console.log('[printReceipt] invoice keys:', Object.keys(src), 'totals:', {
            total_amount: invoice.total_amount,
            total_vat_base: invoice.total_vat_base,
            total_vat: invoice.total_vat,
            total_harbor_tax: invoice.total_harbor_tax,
        });
        const cardPayment = karticnoTerecenje(src);
        await nativePrintReceipt({
            invoice,
            cardPayment,
            items: items || [],
            paymentName: paymentName || '',
            basicData: basicData || {},
            operator: operator || {},
            voyage: voyage || {},
            fromHarbor: fromHarbor || {},
            toHarbor: toHarbor || {},
            isReprint: !!isReprint,
        });
        return true;
    } catch (e) {
        console.warn('[printReceipt] ERROR:', e?.message || e);
        return false;
    }
}

// Ispis zaključka smjene.
// args: { shift, basicData, isReprint }
export async function printShiftReport({ shift, basicData, isReprint }) {
    if (!sunmiPrinterAvailable || !shift) return;
    try {
        await nativePrintShiftReport({
            shift: shift || {},
            basicData: basicData || {},
            isReprint: !!isReprint,
        });
    } catch (e) {
        console.warn('[printShiftReport] ERROR:', e?.message || e);
    }
}

// Ispis pojedinačnih karata. args: { tickets, basicData, voyage, isReprint }
export async function printTickets({ tickets, basicData, voyage, isReprint }) {
    // Dodatne karte (dojenče) nemaju svoju kartu ni QR — na karti roditelja
    // ispisuju se kao redak „+ Dodatno / Extra" (polje `dodatne`), kao na desku.
    const dodatne = (tickets || []).filter((t) => t.is_extra);
    tickets = (tickets || []).filter((t) => !t.is_extra).map((t) => {
        const uz = dodatne.filter((d) => d.extra_of_ticket_uuid === t.ticket_uuid).map((d) => d.ticket_type_name || '');
        return uz.length ? { ...t, dodatne: uz } : t;
    });
    if (!sunmiPrinterAvailable || !tickets?.length) return true;
    try {
        await nativePrintTickets({
            tickets,
            basicData: basicData || {},
            voyage: voyage || {},
            isReprint: !!isReprint,
        });
        return true;
    } catch (e) {
        console.warn('[printTickets] ERROR:', e?.message || e);
        return false;
    }
}
