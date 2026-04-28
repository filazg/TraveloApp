const { buildUblInvoice } = require('../integrations/yescorUblBuilder');
const { sendInvoice, validateInvoice } = require('../integrations/yescorClient');

// Test endpoint: generira dummy UBL 2.1 invoice i pošalje na YesCor demo.
// Query params mogu override-ati default dummy podatke — npr.
//   /yescor_test_submit?validate_only=true    → samo validate (no fiscalization)
//   /yescor_test_submit?customer_oib=12345678901&customer_name=Test
const yescorTestSubmitController = async (req, res) => {
    try {
        const q = req.query || {};
        const now = new Date();
        const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const nowTime = now.toISOString().slice(11, 19); // HH:mm:ss
        const invoiceNo = q.invoice_id || `TEST-${Date.now()}`;

        // Dummy item: 1× putna karta Split-Hvar, 12.40 EUR (bruto), 25% PDV
        const grossTotal = Number(q.amount) || 12.40;
        const taxPercent = 25;
        const netTotal = +(grossTotal / (1 + taxPercent / 100)).toFixed(2);
        const vat = +(grossTotal - netTotal).toFixed(2);

        const data = {
            invoice: {
                id: invoiceNo,
                issue_date: today,
                issue_time: nowTime,
                due_date: today,
                note: 'TEST YesCor F2 submission — ignoriraj',
                profile_id: 'P1',
            },
            operator: {
                mark: 'T4B01',
                oib: '32137068117',
            },
            supplier: {
                oib: '32137068117',
                name: 'Tech4beez d.o.o.',
                address: 'Testna ulica 1',
                town: 'Zagreb',
                postal_code: '10000',
                country: 'HR',
                email: 'info@tech4beez.com',
            },
            customer: {
                oib: q.customer_oib || '12345678903', // dummy test OIB
                name: q.customer_name || 'Test Kupac d.o.o.',
                address: 'Kupac ulica 5',
                town: 'Split',
                postal_code: '21000',
                country: 'HR',
            },
            payment: {
                means_code: q.payment_means || '48', // 48 = card
            },
            items: [
                {
                    name: q.item_name || 'Putna karta Split - Hvar',
                    quantity: 1,
                    unit_code: 'C62', // C62 = "one" (unit per UN/ECE Rec 20)
                    unit_price_net: netTotal,
                    line_total_net: netTotal,
                    tax_percent: taxPercent,
                },
            ],
            totals: {
                line_total_net: netTotal,
                tax_exclusive: netTotal,
                tax: vat,
                tax_inclusive: grossTotal,
                payable: grossTotal,
                tax_percent: taxPercent,
            },
        };

        const ublXml = buildUblInvoice(data);
        const fileName = `test-invoice-${invoiceNo}.xml`;

        // Validate ili Submit ovisno o query param-u.
        const validateOnly = String(q.validate_only || '').toLowerCase() === 'true';
        const apiResp = validateOnly
            ? await validateInvoice(ublXml, { fileName })
            : await sendInvoice(ublXml, { fileName });

        return res.status(200).json({
            status: 200,
            data: {
                mode: validateOnly ? 'validate' : 'submit',
                sent_payload: data,
                ubl_xml_preview: ublXml.slice(0, 800) + (ublXml.length > 800 ? '...' : ''),
                ubl_xml_length: ublXml.length,
                yescor_http_status: apiResp.status,
                yescor_response: apiResp.data,
            },
        });
    } catch (error) {
        console.log('yescorTestSubmitController error:', error?.message || error);
        return res.status(500).json({ status: 500, data: { message: error.message, stack: error.stack } });
    }
};

module.exports = { yescorTestSubmitController };
