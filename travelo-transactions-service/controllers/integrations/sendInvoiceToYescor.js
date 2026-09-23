const { buildUblInvoice } = require('./yescorUblBuilder');
const { sendInvoice } = require('./yescorClient');
const { buildInvoicePdfBuffer } = require('../dataControllers/invoicePdfController');

// Gornja granica za ugradeni PDF. Base64 napuhne sadrzaj za trecinu, a cijeli
// dokument ide u jednom zahtjevu — predimenzionirani privitak bi srusio slanje
// racuna, sto je gore nego racun bez privitka.
const MAX_PRIVITAK_B = 2 * 1024 * 1024;

// PDF racuna kao privitak uz e-racun. Ne rusi slanje: kad se PDF ne moze
// napraviti (nema modela, racun jos nije u bazi, predugacak ispis), racun ide
// bez njega i to se zabiljezi u log.
const pripremiPdfPrivitak = async ({ models, invoice_uuid, broj }) => {
    if (!models || !invoice_uuid) return null;
    try {
        const buffer = await buildInvoicePdfBuffer({ models, invoice_uuid });
        if (!buffer || !buffer.length) return null;
        if (buffer.length > MAX_PRIVITAK_B) {
            console.log(`[yescor] PDF racuna ${broj} je ${buffer.length} B — preko granice, salje se bez privitka`);
            return null;
        }
        return {
            id: 'RACUN-PDF',
            description: 'Racun u PDF obliku',
            filename: `racun-${String(broj || invoice_uuid).replace(/[^\w.-]+/g, '_')}.pdf`,
            mime: 'application/pdf',
            base64: buffer.toString('base64'),
        };
    } catch (e) {
        console.log('[yescor] PDF privitak nije napravljen:', e?.message || e);
        return null;
    }
};

// Map internal invoice + items + company + buyer → UBL data struct.
// Zove se nakon uspješnog InvoiceModel.create u finalize flow.
//
// Ne bacuje (catch u pozivaču) — ako YesCor fail, invoice i dalje postoji,
// samo yescor_status ostaje 'failed' i može se kasnije retry-ati.
const sendInvoiceToYescor = async ({
    invoice,         // InvoiceModel row (plain) ili objekt sa invoice_* poljima
    items,           // [{ ticket_type_name, quantity, single_price, item_vat_base, item_vat, cpa_code }]
    company,         // { name, address, postal_code, town, legal_id, vat_id, email }
    operator,        // { mark, oib }
    buyer,           // { buyer_name, buyer_oib, buyer_address, buyer_postal_code, buyer_town, buyer_country, buyer_email }
    paymentMeans,    // '10' cash / '48' card / '30' transfer
    models,          // sequelize modeli — trebaju za PDF privitak (neobavezno)
}) => {
    // 1) Izračun ukupnih iznosa (neto per liniji → net total + VAT).
    // Naš model: invoice_amount = bruto ukupno; invoice_vat_base = PDV osnovica;
    // invoice_vat = PDV 25%; invoice_harbor_tax = lučka 6% (nije UBL VAT, stavit
    // ćemo kao allowance charge ili uključiti u neto za test).
    // Za testni case, koristimo samo vat_base + vat, ignoriramo harbor tax za sad.
    const netTotal = Number(invoice.invoice_vat_base) || 0;
    const vatAmount = Number(invoice.invoice_vat) || 0;
    const grossTotal = netTotal + vatAmount;
    const taxPercent = 25;

    // 2) Format items za UBL.
    const ublItems = (items || []).map((it) => {
        const qty = Number(it.quantity || it.qty || 1);
        const itemNetTotal = Number(it.item_vat_base) || 0;
        const unitNet = qty > 0 ? itemNetTotal / qty : 0;
        return {
            name: it.ticket_type_name || 'Putna karta',
            quantity: qty,
            unit_code: 'C62',
            unit_price_net: unitNet,
            line_total_net: itemNetTotal,
            tax_percent: taxPercent,
            cpa_code: it.cpa_code || '50.10.11', // default: trajektni prijevoz
        };
    });

    // 3) Build UBL XML.
    const issueDate = new Date(invoice.invoice_date || Date.now());
    const iso = issueDate.toISOString();
    const invoiceNoFormatted = invoice.invoice_code
        || (invoice.invoice_fiskal_no != null
            ? `${invoice.invoice_fiskal_no}/${invoice.invoice_year || iso.slice(0,4)}`
            : String(invoice.invoice_no || invoice.invoice_uuid).slice(0, 20));

    // Kupac uz e-racun dobiva i PDF: UBL nosi podatke, PDF ono sto covjek cita.
    const pdfPrivitak = await pripremiPdfPrivitak({
        models,
        invoice_uuid: invoice.invoice_uuid,
        broj: invoiceNoFormatted,
    });

    const ublXml = buildUblInvoice({
        attachments: pdfPrivitak ? [pdfPrivitak] : [],
        invoice: {
            id: invoiceNoFormatted,
            issue_date: iso.slice(0, 10),
            issue_time: iso.slice(11, 19),
            due_date: iso.slice(0, 10),
            profile_id: 'P1',
        },
        supplier: {
            oib: company.legal_id || company.vat_id || '',
            name: company.name || '',
            address: company.address || '',
            town: company.town || '',
            postal_code: company.postal_code || '',
            country: 'HR',
            email: company.email || '',
        },
        customer: {
            oib: buyer.buyer_oib || buyer.buyer_vat_id || '',
            name: buyer.buyer_company_name || buyer.buyer_name || '',
            address: buyer.buyer_address || '',
            town: buyer.buyer_town || '',
            postal_code: buyer.buyer_postal_code || '',
            country: buyer.buyer_country || 'HR',
        },
        operator: {
            // Ako operator nema svoj OIB (nije spremljen per-user), fallback
            // na company OIB — validna vrijednost za YesCor, ali kasnije dodati
            // `user_oib` u user model + sync ako je regulator bude zahtijevao.
            mark: operator?.mark || operator?.operator_mark || '',
            oib: operator?.oib || operator?.operator_oib || company.legal_id || company.vat_id || '',
        },
        payment: { means_code: paymentMeans || '10' },
        items: ublItems,
        totals: {
            line_total_net: netTotal,
            tax_exclusive: netTotal,
            tax: vatAmount,
            tax_inclusive: grossTotal,
            payable: grossTotal,
            tax_percent: taxPercent,
        },
    });

    const fileName = `invoice_${(invoice.invoice_uuid || Date.now()).toString().slice(0, 20)}.xml`;
    const resp = await sendInvoice(ublXml, { fileName });
    return { ublXml, fileName, response: resp };
};

module.exports = { sendInvoiceToYescor };
