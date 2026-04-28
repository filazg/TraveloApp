// Build a finalized sale entirely on-device when the backend is unreachable.
// Returns the same shape as the backend's finalize_terminal_sale response so the
// UI/print code doesn't need to branch.
import 'react-native-get-random-values'; // polyfill for crypto.getRandomValues used by uuid
import { v4 as uuidv4 } from 'uuid';
import { getSetting, setSetting } from '../db/db';

const HARBOR_RATE = 0.06;
const VAT_RATE = 0.25;
const splitAmount = (amount) => {
    const port = +(amount * HARBOR_RATE).toFixed(2);
    const net = amount - port;
    const base = +(net / (1 + VAT_RATE)).toFixed(2);
    const vat = +(net - base).toFixed(2);
    return { port, base, vat };
};

const randomCode = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 10; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
};

const KEY_INVOICE_SEQ = 'local_invoice_seq';
const KEY_FISKAL_SEQ = 'local_fiskal_seq';
const KEY_INVOICE_YEAR = 'local_invoice_year';

async function nextLocalInvoiceNo() {
    const year = new Date().getFullYear();
    const storedYear = parseInt((await getSetting(KEY_INVOICE_YEAR)) || '0', 10);
    if (storedYear !== year) {
        await setSetting(KEY_INVOICE_YEAR, String(year));
        await setSetting(KEY_INVOICE_SEQ, '0');
        await setSetting(KEY_FISKAL_SEQ, '0');
    }
    const cur = parseInt((await getSetting(KEY_INVOICE_SEQ)) || '0', 10) + 1;
    await setSetting(KEY_INVOICE_SEQ, String(cur));
    return cur;
}

async function nextLocalFiskalNo() {
    const cur = parseInt((await getSetting(KEY_FISKAL_SEQ)) || '0', 10) + 1;
    await setSetting(KEY_FISKAL_SEQ, String(cur));
    return cur;
}

export async function buildLocalSale({ items, terminal_uuid, payment_method_uuid, operator, basicData, paymentMethods }) {
    const year = new Date().getFullYear();
    const invoice_no = await nextLocalInvoiceNo();
    const fiskal_no = await nextLocalFiskalNo();
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
                single_price: unit,
                status: autoValidated ? 'validated' : 'created',
                validate_data: autoValidated ? new Date().toISOString() : null,
                route_uuid: r.route_uuid,
            });
        }
    }

    const invoice_code = basicData?.business_premise_fiscal_mark && basicData?.billing_device_fiscal_mark
        ? `${fiskal_no}/${basicData.business_premise_fiscal_mark}/${basicData.billing_device_fiscal_mark}`
        : null;

    return {
        invoice_uuid,
        invoice_no,
        invoice_year: year,
        invoice_fiskal_no: fiskal_no,
        invoice_code,
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
        // Mark for sync
        _local: true,
        _localPayload: {
            items, terminal_uuid, payment_method_uuid, operator,
        },
    };
}
