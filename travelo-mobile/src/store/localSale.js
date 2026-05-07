// Build a finalized sale entirely on-device when the backend is unreachable.
// Returns the same shape as the backend's finalize_terminal_sale response so the
// UI/print code doesn't need to branch.
import { getSetting, setSetting } from '../db/db';
import { maxLocalInvoiceNoByType, maxLocalTotalInvoiceNo } from '../db/repo';

// Lokalni RFC 4122 v4 UUID generator — bez ovisnosti o `react-native-get-random-values`
// (taj paket je TurboModule-only u v2.0+, naš RN bridge je classic). Math.random je
// dovoljan za lokalne ID-eve (invoice_uuid, order_uuid, ticket_uuid) jer ti se
// sinkroniziraju s backendom koji vrši deduplication.
const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

const HARBOR_RATE = 0.06;
const VAT_RATE = 0.25;
const splitAmount = (amount) => {
    const port = +(amount * HARBOR_RATE).toFixed(2);
    const net = amount - port;
    const base = +(net / (1 + VAT_RATE)).toFixed(2);
    const vat = +(net - base).toFixed(2);
    return { port, base, vat };
};

// Alfabet bez 0/O/1/I — vizualno nedvosmislen kod za ručni unos / OCR.
const ALPHA32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomFromAlpha = (len) => {
    let s = '';
    for (let i = 0; i < len; i++) s += ALPHA32[Math.floor(Math.random() * ALPHA32.length)];
    return s;
};
const randomCode = () => randomFromAlpha(10);          // ticket_code
const randomInvoiceCodeF2 = () => randomFromAlpha(8);  // F2 invoice_code (vidljivi "Račun br")

// Numeriranje računa je ISKLJUČIVO lokalno (vidi memoriju "Numeriranje računa").
//   KEY_TOTAL_SEQ — ukupna kardinalnost svih računa na NU (F1 + F2 + storni).
//   KEY_F1_SEQ    — sekvenca za F1 račune (B2C bez OIB-a). Koristi se u
//                   fiskalnoj oznaci NO/PP/NU. F2 računi NE inkrementiraju
//                   ovaj brojač.
//   KEY_F2_SEQ    — sekvenca za F2 račune (R1 sa OIB-om). Vlastiti format
//                   po HRFISK20 specu, ne dira F1.
// Sve sekvence resetiraju se 1.1. svake godine.
const KEY_TOTAL_SEQ = 'local_invoice_seq';   // legacy ime, ostaje radi backwards compat
const KEY_F1_SEQ = 'local_fiskal_seq';        // legacy ime — sad isključivo F1
const KEY_F2_SEQ = 'local_f2_seq';
const KEY_INVOICE_YEAR = 'local_invoice_year';

async function ensureCurrentYear() {
    const year = new Date().getFullYear();
    const storedYear = parseInt((await getSetting(KEY_INVOICE_YEAR)) || '0', 10);
    if (storedYear !== year) {
        await setSetting(KEY_INVOICE_YEAR, String(year));
        await setSetting(KEY_TOTAL_SEQ, '0');
        await setSetting(KEY_F1_SEQ, '0');
        await setSetting(KEY_F2_SEQ, '0');
    }
    return year;
}

// Brojači se "podižu" iznad maksimalnog već zabilježenog broja u lokalnoj DB
// za tekuću godinu i tip — pokriva tranziciju s ranijih backend-driven izdanja
// gdje je invoice_no dolazio iz backenda, pa sljedeći račun ne bude manji od
// bilo kojeg već izdanog ove godine.
async function nextSeq(key, year, observedMax) {
    const stored = parseInt((await getSetting(key)) || '0', 10);
    const base = Math.max(stored, observedMax || 0);
    const cur = base + 1;
    await setSetting(key, String(cur));
    return cur;
}

// Inkrementira ukupnu sekvencu (sve vrste računa).
async function nextTotalNo() {
    const year = await ensureCurrentYear();
    const observed = await maxLocalTotalInvoiceNo(year);
    return nextSeq(KEY_TOTAL_SEQ, year, observed);
}

// Inkrementira F1 sekvencu (B2C — koristi se u NO/PP/NU oznaci).
async function nextF1No() {
    const year = await ensureCurrentYear();
    const observed = await maxLocalInvoiceNoByType(year, false);
    return nextSeq(KEY_F1_SEQ, year, observed);
}

// Inkrementira F2 sekvencu (R1 + f2_required, HRFISK20 fiskalizacija).
async function nextF2No() {
    const year = await ensureCurrentYear();
    const observed = await maxLocalInvoiceNoByType(year, true);
    return nextSeq(KEY_F2_SEQ, year, observed);
}

export async function buildLocalSale({ items, terminal_uuid, payment_method_uuid, operator, basicData, paymentMethods, buyer }) {
    const year = new Date().getFullYear();
    // F2 ide u F2 brojač ISKLJUČIVO kad operator eksplicitno označi `f2_required` u R1 modalu.
    // R1 bez tog flag-a (npr. samo zbog OIB-a kupca) ostaje F1 — vidi project_invoice_numbering_rules.md.
    const isF2 = !!(buyer && buyer.f2_required);
    const total_no = await nextTotalNo();
    const seq_no = isF2 ? await nextF2No() : await nextF1No();
    const invoice_no = seq_no;
    const fiskal_no = seq_no;
    const invoice_uuid = uuidv4();
    const order_uuid = uuidv4();
    const autoValidated = !!basicData?.billing_device_auto_validate;
    const pm = (paymentMethods || []).find((x) => x.uuid === payment_method_uuid)
        || (paymentMethods || [])[0]
        || { uuid: payment_method_uuid, name: 'Plaćanje' };

    let total_amount = 0, total_vat_base = 0, total_vat = 0, total_harbor_tax = 0;
    const tickets = [];
    for (const it of items) {
        const qty = parseInt(it.qty, 10) || 0;
        if (!qty) continue;
        const unit = Number(it.unit_price) || 0;
        const subtotal = +(unit * qty).toFixed(2);
        const { port, base, vat } = splitAmount(subtotal);
        total_amount += subtotal;
        total_vat_base += base;
        total_vat += vat;
        total_harbor_tax += port;

        const r = it.route || {};
        for (let i = 0; i < qty; i++) {
            const tuuid = uuidv4();
            // QR payload usklađen s portalom (transactions-service ticketPdfController.qrPayload).
            const ticket_qr = [
                tuuid,
                r.line_code || '',
                r.departure_harbor_name || '',
                r.arrival_harbor_name || '',
                r.departure_planned || '',
                r.route_uuid || '',
                it.ticket_type_uuid || '',
            ].join(';');
            tickets.push({
                ticket_uuid: tuuid,
                ticket_code: randomCode(),
                ticket_qr,
                ticket_type_uuid: it.ticket_type_uuid,
                ticket_type_name: it.ticket_type_name,
                line_code: r.line_code,
                line_name: r.line_name,
                departure_harbor_id: r.departure_harbor_id,
                departure_harbor_name: r.departure_harbor_name,
                arrival_harbor_id: r.arrival_harbor_id,
                arrival_harbor_name: r.arrival_harbor_name,
                departure_planed: r.departure_planned,
                arrival_planed: r.arrival_planned,
                single_price: unit,
                status: autoValidated ? 'validated' : 'created',
                validate_data: autoValidated ? new Date().toISOString() : null,
                route_uuid: r.route_uuid,
            });
        }
    }

    // F1: fiskalna oznaka NO/PP/NU.
    // F2: 8-znamenkasti random kod (vidljivi "Račun br" na ispisu i u pregledu).
    const invoice_code = isF2
        ? randomInvoiceCodeF2()
        : (basicData?.business_premise_fiscal_mark && basicData?.billing_device_fiscal_mark
            ? `${fiskal_no}/${basicData.business_premise_fiscal_mark}/${basicData.billing_device_fiscal_mark}`
            : null);

    return {
        invoice_uuid,
        invoice_no,
        invoice_year: year,
        invoice_fiskal_no: fiskal_no,
        invoice_total_no: total_no,
        invoice_code,
        is_f2: isF2,
        order_uuid,
        total_amount: +total_amount.toFixed(2),
        total_vat_base: +total_vat_base.toFixed(2),
        total_vat: +total_vat.toFixed(2),
        total_harbor_tax: +total_harbor_tax.toFixed(2),
        payment_method_name: pm.name,
        tickets_count: tickets.length,
        fiskal_required: false,
        auto_validated: autoValidated,
        tickets,
        // Spread buyer_* polja (buyer_oib, buyer_name, buyer_address, ...) na top-level
        // tako da ih native print sloj nađe preko safeString(r, "buyer_oib") itd.
        ...(buyer || {}),
        buyer: buyer || null,
        // Mark for sync
        _local: true,
        _localPayload: {
            items, terminal_uuid, payment_method_uuid, operator, buyer,
        },
    };
}

// Storno = potpuno samostalno generiran račun s negativnim iznosima.
// Dobiva sljedeći broj iz iste sekvence kao i prodajni računi (ne ovisi o
// backendu). Originalni račun se NE mijenja — samo se vodi naznaka veze
// (storno_of_invoice_uuid).
export async function buildLocalStorno({
    originalInvoice,
    ticketsToCancel,
    percentage = 100,
    paymentMethodUuid,
    paymentMethodName,
    basicData,
}) {
    const year = new Date().getFullYear();
    // Storno prati tip izvornog računa (storno F1 → F1 sekvenca, storno F2 → F2 sekvenca).
    const isF2 = !!originalInvoice?.is_f2;
    const total_no = await nextTotalNo();
    const seq_no = isF2 ? await nextF2No() : await nextF1No();
    const invoice_no = seq_no;
    const fiskal_no = seq_no;
    const invoice_uuid = uuidv4();
    const order_uuid = uuidv4();
    const pct = Math.max(0, Math.min(100, Number(percentage) || 0));

    let total_amount = 0, total_vat_base = 0, total_vat = 0, total_harbor_tax = 0;
    const items = [];
    for (const t of (ticketsToCancel || [])) {
        const unit = +((Number(t.single_price) || 0) * (pct / 100)).toFixed(2);
        const subtotal = unit; // qty=1 po karti
        const { port, base, vat } = splitAmount(subtotal);
        total_amount -= subtotal;
        total_vat_base -= base;
        total_vat -= vat;
        total_harbor_tax -= port;
        items.push({
            ticket_type_uuid: t.ticket_type_uuid,
            ticket_type_name: t.ticket_type_name,
            qty: 1,
            unit_price: -unit,
            departure_harbor_id: t.departure_harbor_id,
            departure_harbor_name: t.departure_harbor_name,
            arrival_harbor_id: t.arrival_harbor_id,
            arrival_harbor_name: t.arrival_harbor_name,
            line_code: t.line_code,
            line_name: t.line_name,
            route_uuid: t.route_uuid,
        });
    }

    const invoice_code = isF2
        ? randomInvoiceCodeF2()
        : (basicData?.business_premise_fiscal_mark && basicData?.billing_device_fiscal_mark
            ? `${fiskal_no}/${basicData.business_premise_fiscal_mark}/${basicData.billing_device_fiscal_mark}`
            : null);

    return {
        invoice_uuid,
        invoice_no,
        invoice_year: year,
        invoice_fiskal_no: fiskal_no,
        invoice_total_no: total_no,
        invoice_code,
        is_f2: isF2,
        order_uuid,
        total_amount: +total_amount.toFixed(2),
        total_vat_base: +total_vat_base.toFixed(2),
        total_vat: +total_vat.toFixed(2),
        total_harbor_tax: +total_harbor_tax.toFixed(2),
        payment_method_uuid: paymentMethodUuid,
        payment_method_name: paymentMethodName,
        tickets_count: items.length,
        fiskal_required: false,
        items,
        is_storno: true,
        storno_of_invoice_uuid: originalInvoice?.invoice_uuid || null,
        storno_of_invoice_no: originalInvoice?.invoice_no || null,
        storno_percentage: pct,
        _local: true,
    };
}
