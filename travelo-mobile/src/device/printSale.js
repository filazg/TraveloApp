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
    if (!sunmiPrinterAvailable) return;
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
        await nativePrintReceipt({
            invoice,
            items: items || [],
            paymentName: paymentName || '',
            basicData: basicData || {},
            operator: operator || {},
            voyage: voyage || {},
            fromHarbor: fromHarbor || {},
            toHarbor: toHarbor || {},
            isReprint: !!isReprint,
        });
    } catch (e) {
        console.warn('[printReceipt] ERROR:', e?.message || e);
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
    if (!sunmiPrinterAvailable || !tickets?.length) return;
    try {
        await nativePrintTickets({
            tickets,
            basicData: basicData || {},
            voyage: voyage || {},
            isReprint: !!isReprint,
        });
    } catch (e) {
        console.warn('[printTickets] ERROR:', e?.message || e);
    }
}
