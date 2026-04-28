// Termalni ispis računa i karata na Sunmi V2s. Funkcije primaju sve podatke
// kao argumente (ne ovisi o React state-u) — pozivaju se i pri prodaji
// (SaleScreen) i pri reprint-u iz Dokumenata (DocumentsScreen).

import {
    ALIGN, STYLE, bindPrinter, cutPaper, enterPrinterBuffer, exitPrinterBuffer,
    lineWrap, printRawQR, printText, sendRawBytes, setAlignment, setFontSize,
    setHeatingParams, setPrinterStyle, sunmiPrinterAvailable, waitPrinterIdle,
} from './printer';

// ESC E n  — emphasis (jača bold)
// ESC G n  — double-strike (printer prinata svaki red dva puta = znatno deblja slova)
// Kombinacija + povećani heat = maksimalno tamna slova bez ručnog mijenjanja drivera.
async function enableHeavyInk() {
    try { await sendRawBytes([0x1B, 0x45, 0x01]); } catch {}
    try { await sendRawBytes([0x1B, 0x47, 0x01]); } catch {}
}
async function disableHeavyInk() {
    try { await sendRawBytes([0x1B, 0x47, 0x00]); } catch {}
    try { await sendRawBytes([0x1B, 0x45, 0x00]); } catch {}
}

const W = 32;
const SEP_HARD = '='.repeat(W) + '\n';
const SEP_SOFT = '-'.repeat(W) + '\n';
const SEP_DOT  = '·'.repeat(W) + '\n';
const padR = (s, w) => String(s).slice(0, w).padEnd(w, ' ');
const padL = (s, w) => String(s).slice(0, w).padStart(w, ' ');
const kv = (k, vstr) => `${padR(k, 18)}${padL(vstr, 14)}\n`;
// Naziv lijevo + iznos desno popunjeno crticama "UKUPNO ........ 12.50".
const kvDots = (k, vstr) => {
    const left = String(k);
    const right = String(vstr);
    const fill = Math.max(1, W - left.length - right.length);
    return `${left}${'.'.repeat(fill)}${right}\n`;
};
const itemRow = (name, qty, price, total) => {
    const right = `${qty}x${(Number(price) || 0).toFixed(2)} ${padL((Number(total) || 0).toFixed(2), 7)}`;
    const nameWidth = Math.max(8, W - right.length - 1);
    return `${padR(name, nameWidth)} ${right}\n`;
};
const fmtDate = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

// Strukturirani POS račun (HR fiskalna kasa, 32 znaka širine).
// args:
//   r            — invoice response (invoice_no, invoice_year, invoice_code, totals…)
//   items        — [{ ticket_type_name, qty, unit_price }]
//   paymentName  — string (npr. "Gotovina")
//   basicData    — sync.basicData (client_*, business_premise_*, billing_device_*)
//   operator     — { user_name, user_surname }
//   voyage       — { line_code, first_departure_time }  (može biti null kod reprint-a)
//   fromHarbor   — { name }
//   toHarbor     — { name }
//   isReprint    — true → ispiši "** PREPIS **" header
export async function printReceipt({ r, items, paymentName, basicData, operator, voyage, fromHarbor, toHarbor, isReprint }) {
    if (!sunmiPrinterAvailable) return;
    const bd = basicData || {};
    try {
        await bindPrinter();
        await enterPrinterBuffer(true);
        // Maksimalno tamniji ispis za V2s: heat 13 (max sigurno), 240µs, interval 4.
        await setHeatingParams(13, 240, 4);
        // bold već uključen na početku
        await enableHeavyInk(); // ESC E 1 + ESC G 1 — emphasis + double-strike

        // ===== HEADER ===== (firma — bold, veliki font)
        await setAlignment(ALIGN.CENTER);
        await setFontSize(34);
        await printText(`${bd.client_name || 'TRAVELO'}\n`);
        // bold ostaje aktivan kroz cijeli ispis
        await setFontSize(22);
        if (bd.client_address) await printText(`${bd.client_address}\n`);
        const cityLine = `${bd.client_postal_code || ''} ${bd.client_town || ''}`.trim();
        if (cityLine) await printText(`${cityLine}\n`);
        if (bd.client_legal_id) await printText(`OIB ${bd.client_legal_id}\n`);
        if (bd.client_vat_id && bd.client_vat_id !== bd.client_legal_id) {
            await printText(`PDV ID ${bd.client_vat_id}\n`);
        }
        await lineWrap(1);

        if (isReprint) {
            // bold već uključen na početku
            await setFontSize(38);
            await printText('*** KOPIJA ***\n');
            await setFontSize(22);
            // bold ostaje aktivan kroz cijeli ispis
            await lineWrap(1);
        }

        // ===== INVOICE NO ===== (najistaknutiji red — veliki bold)
        // bold već uključen na početku
        await setFontSize(36);
        await printText(`RAČUN ${r.invoice_no}/${r.invoice_year || ''}\n`);
        await setFontSize(24);
        if (r.invoice_code) await printText(`${r.invoice_code}\n`);
        else if (r.invoice_fiskal_no) await printText(`Fisk: ${r.invoice_fiskal_no}\n`);
        // bold ostaje aktivan kroz cijeli ispis
        if (r.fiskal_required) {
            await setFontSize(22);
            await printText('FISKALIZACIJA 2.0\n');
        }
        if (r._local) {
            await setFontSize(22);
            await printText('* OFFLINE — čeka sinkronizaciju *\n');
        }
        await lineWrap(1);

        // ===== META ===== (manji font, label bold + vrijednost normal)
        await setAlignment(ALIGN.LEFT);
        await setFontSize(22);
        const metaRow = async (label, value) => {
            // bold već uključen na početku
            await printText(padR(label, 14));
            // bold ostaje aktivan kroz cijeli ispis
            await printText(`${value}\n`);
        };
        await metaRow('Prostor:', bd.business_premise_name || '-');
        await metaRow('Uređaj:', `${bd.billing_device_name || '-'}${bd.billing_device_fiscal_mark ? ` (${bd.billing_device_fiscal_mark})` : ''}`);
        const opName = `${operator?.user_name || operator?.name || r.operater_name || ''} ${operator?.user_surname || ''}`.trim();
        if (opName) await metaRow('Operater:', opName);
        await metaRow('Datum:', fmtDate(new Date()));
        if (isReprint && r.created_at) await metaRow('Original:', fmtDate(new Date(r.created_at)));
        await lineWrap(1);

        // ===== VOYAGE ===== (banner s linijom + relacijom)
        const fromName = fromHarbor?.name || items?.[0]?.route?.departure_harbor_name || items?.[0]?.departure_harbor_name || '';
        const toName = toHarbor?.name || items?.[0]?.route?.arrival_harbor_name || items?.[0]?.arrival_harbor_name || '';
        const lineCode = voyage?.line_code || items?.[0]?.route?.line_code || items?.[0]?.line_code || '';
        const departureTime = voyage?.first_departure_time || items?.[0]?.route?.departure_planned || '';
        await setAlignment(ALIGN.CENTER);
        await printText(SEP_HARD);
        // bold već uključen na početku
        await setFontSize(28);
        if (lineCode || departureTime) await printText(`${lineCode}${lineCode && departureTime ? '  ' : ''}${departureTime}\n`);
        await setFontSize(26);
        if (fromName || toName) await printText(`${fromName} → ${toName}\n`);
        // bold ostaje aktivan kroz cijeli ispis
        await printText(SEP_HARD);
        await setAlignment(ALIGN.LEFT);

        // ===== ITEMS =====
        await setFontSize(22);
        // bold već uključen na početku
        await printText(`${padR('Stavka', 18)}${padL('Kol×Cij', 7)}${padL('Iznos', 7)}\n`);
        // bold ostaje aktivan kroz cijeli ispis
        await printText(SEP_DOT);
        for (const it of (items || [])) {
            const qty = Number(it.qty) || 0;
            const unit = Number(it.unit_price) || 0;
            await printText(itemRow(it.ticket_type_name || '', qty, unit, qty * unit));
        }
        await printText(SEP_DOT);

        // ===== TOTALS =====
        await setFontSize(22);
        await printText(kv('Osnovica PDV-a', `${(Number(r.total_vat_base) || 0).toFixed(2)}`));
        await printText(kv('PDV 25%', `${(Number(r.total_vat) || 0).toFixed(2)}`));
        await printText(kv('Lučka naknada', `${(Number(r.total_harbor_tax) || 0).toFixed(2)}`));
        await lineWrap(1);
        await printText(SEP_HARD);
        // bold već uključen na početku
        await setFontSize(34);
        const totalStr = `${(Number(r.total_amount) || Number(r.amount) || 0).toFixed(2)} EUR`;
        await printText(kvDots('UKUPNO', totalStr));
        await setFontSize(22);
        // bold ostaje aktivan kroz cijeli ispis
        await printText(SEP_HARD);

        await printText(`Način plaćanja: ${paymentName || r.payment_method_name || '-'}\n`);
        if (r.auto_validated) await printText('Karte VALIDIRANE pri prodaji\n');
        await lineWrap(2);

        // ===== FOOTER =====
        await setAlignment(ALIGN.CENTER);
        await setFontSize(20);
        await printText('Reklamacije unutar 8 dana uz\n');
        await printText('original računa\n');
        if (bd.client_email) await printText(`${bd.client_email}\n`);
        await lineWrap(1);
        if (isReprint) {
            // bold već uključen na početku
            await setFontSize(22);
            await printText('KOPIJA — nije fiskalni original\n');
            // bold ostaje aktivan kroz cijeli ispis
        } else {
            await setFontSize(24);
            await printText('Hvala na povjerenju!\n');
        }
        await lineWrap(3);
        try { await cutPaper(); } catch {}
        await disableHeavyInk();
        await exitPrinterBuffer(true);
        await waitPrinterIdle(4000);
    } catch (e) {
        console.warn('[printReceipt] ERROR:', e?.message || e);
        try { await exitPrinterBuffer(false); } catch {}
    }
}

// Ispis pojedinačnih karata. args: { tickets, basicData, voyage, isReprint }
export async function printTickets({ tickets, basicData, voyage, isReprint }) {
    if (!sunmiPrinterAvailable || !tickets?.length) return;
    const bd = basicData || {};
    try {
        await bindPrinter();
        for (const t of tickets) {
            await enterPrinterBuffer(true);
            await setHeatingParams(13, 240, 4);
            await setPrinterStyle(STYLE.ENABLE_BOLD, 1);
            await enableHeavyInk();

            // ===== HEADER =====
            await setAlignment(ALIGN.CENTER);
            await setFontSize(40);
            await printText('KARTA\n');
            await setFontSize(22);
            // bold ostaje aktivan kroz cijeli ispis
            await printText(`${bd.client_name || 'TRAVELO'}\n`);
            if (isReprint) {
                // bold već uključen na početku
                await setFontSize(36);
                await printText('*** KOPIJA ***\n');
                await setFontSize(22);
                // bold ostaje aktivan kroz cijeli ispis
            }
            await printText(SEP_HARD);

            // ===== ROUTE =====
            // bold već uključen na početku
            await setFontSize(28);
            await printText(`${t.departure_harbor_name || ''}\n`);
            await setFontSize(20);
            await printText('▼\n');
            await setFontSize(28);
            await printText(`${t.arrival_harbor_name || ''}\n`);
            // bold ostaje aktivan kroz cijeli ispis
            await setFontSize(22);
            const lineCode = t.line_code || voyage?.line_code || '';
            const departureTime = voyage?.first_departure_time || '';
            if (lineCode || departureTime) await printText(`${lineCode}${lineCode && departureTime ? '  ' : ''}${departureTime}\n`);
            if (t.departure_planed) await printText(`${t.departure_planed}\n`);
            await printText(SEP_DOT);

            // ===== TICKET DETAILS =====
            await setAlignment(ALIGN.LEFT);
            await setFontSize(22);
            // bold već uključen na početku
            await printText(padR('Vrsta:', 10));
            // bold ostaje aktivan kroz cijeli ispis
            await printText(`${t.ticket_type_name || ''}\n`);
            if (t.is_island && t.seop_card_no) {
                // bold već uključen na početku
                await printText(padR('Iskaznica:', 10));
                // bold ostaje aktivan kroz cijeli ispis
                await printText(`${t.seop_card_no}\n`);
                if (t.seop_otok) {
                    // bold već uključen na početku
                    await printText(padR('Otok:', 10));
                    // bold ostaje aktivan kroz cijeli ispis
                    await printText(`${t.seop_otok}\n`);
                }
            }
            // bold već uključen na početku
            await printText(padR('Cijena:', 10));
            // bold ostaje aktivan kroz cijeli ispis
            await printText(`${(Number(t.single_price) || 0).toFixed(2)} EUR\n`);
            await lineWrap(1);

            // ===== STATUS / QR =====
            const isAlreadyValidated = t.status === 'validated';
            await setAlignment(ALIGN.CENTER);
            if (isAlreadyValidated) {
                // bold već uključen na početku
                await setFontSize(32);
                await printText('✓ VALIDIRANO\n');
                await setFontSize(20);
                // bold ostaje aktivan kroz cijeli ispis
                await printText(`${t.ticket_code}\n`);
            } else {
                const qrData = String(t.ticket_qr || t.ticket_uuid || '');
                try { await printRawQR(qrData, 8, 49); } catch (e) {
                    console.warn('[printTickets] printRawQR error:', e?.message || e);
                }
                await lineWrap(1);
                // bold već uključen na početku
                await setFontSize(22);
                await printText(`${t.ticket_code}\n`);
                // bold ostaje aktivan kroz cijeli ispis
                await setFontSize(18);
                await printText('Predočite kartu pri ukrcaju\n');
            }
            await lineWrap(3);
            try { await cutPaper(); } catch {}
            await disableHeavyInk();
            await exitPrinterBuffer(true);
            await waitPrinterIdle(4000);
        }
    } catch (e) {
        console.warn('[printTickets] ERROR:', e?.message || e);
        try { await exitPrinterBuffer(false); } catch {}
    }
}
