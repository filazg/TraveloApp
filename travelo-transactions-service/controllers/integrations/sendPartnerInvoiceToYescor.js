// F2 fiskalizacija zbirnog partnerskog racuna preko YesCor-a.
//
// Odvojeno od sendInvoiceToYescor: racun s blagajne prodaje karte putniku i
// slaze se po stavkama karata, a partnerski racun je jedna usluga za razdoblje
// i ima dva porezna tretmana. Kad bi se gurao kroz isti mapper, dobio bi
// fiksnih 25% i izgubio lucku pristojbu.
const { buildUblInvoice } = require('./yescorUblBuilder');
const { sendInvoice } = require('./yescorClient');

const n = (v) => Number(v) || 0;
const d2 = (v) => +n(v).toFixed(2);

// Datum granice razdoblja dolazi kao DATEONLY string ili Date; za tekst na
// racunu treba samo dan.
const dan = (v) => {
    if (!v) return '';
    const s = String(v);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[3]}.${m[2]}.${m[1]}.`;
    const dt = new Date(v);
    return Number.isNaN(dt.getTime())
        ? ''
        : `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}.`;
};

// Ne baca — pozivac hvata i upisuje yescor_status 'failed', racun ostaje.
const sendPartnerInvoiceToYescor = async ({ invoice, company = {} }) => {
    const vatBase = d2(invoice.vat_base);
    const vatAmount = d2(invoice.vat_amount);
    const harborTax = d2(invoice.harbor_tax_amount);
    const vatRate = n(invoice.vat_rate);
    // Zbroj stavaka mora dati ono sto na racunu pise kao ukupno; racuna se iz
    // istih polja, ne iz net_amount, da se nesklad vidi ovdje a ne u YesCor-u.
    const lineTotalNet = d2(vatBase + harborTax);
    const payable = d2(vatBase + vatAmount + harborTax);

    const razdoblje = [dan(invoice.period_from), dan(invoice.period_to)].filter(Boolean).join(' – ');

    // HR oznaka kategorije PDV-a (HR-BT-12) iz sifarnika HR VAT tax codes.
    // Usluga prijevoza ide po opcoj stopi; ako partner ima drugu stopu, oznaka
    // prati nju, jer sifarnik razlikuje 25 / 13 / 5 posto.
    const HR_STOPA = { 25: 'HR:PDV25', 13: 'HR:PDV13', 5: 'HR:PDV5' };
    const oznakaStope = HR_STOPA[Math.round(vatRate)] || 'HR:PDV25';

    // Lucka pristojba je prolazna stavka po cl. 33. st. 3. Zakona o PDV-u:
    // naplacuje se u cijelosti, ne umanjuje se za proviziju i ne ulazi u
    // osnovicu. Bez toga bi racun tvrdio da je pristojba dio osnovice i trazio
    // PDV na tudi novac.
    //
    // Sifarnik ima i namjensku oznaku HR:CL33 ("ne ulazi u poreznu osnovicu —
    // prolazna stavka cl. 33"), ali je YesCor validator odbija kao vrijednost
    // izvan HR-TB-2 (HR-BR-CL-1) — provjereno na demo okruzenju, prolaze samo
    // HR:E, HR:O, HR:Z i HR:POVNAK. Zato ide opca oznaka oslobodenja HR:E, a
    // tocna pravna osnova stoji u razlogu oslobodenja. Kad validator prihvati
    // HR:CL33, ovdje je jedina izmjena.
    const OZNAKA_PROLAZNE = 'HR:E';
    const RAZLOG_PROLAZNE = 'Prolazna stavka — ne ulazi u poreznu osnovicu (čl. 33. st. 3. Zakona o PDV-u)';

    // Prva stavka je usluga: prodaja karata u razdoblju, umanjena za proviziju.
    // PDV se ne razbija po karti nego stoji na zbroju, pa je i ovdje jedna
    // stavka — razrada karta po karta ide uz racun kao prilog, ne u UBL.
    const items = [{
        name: razdoblje ? `Prodaja karata ${razdoblje}` : 'Prodaja karata',
        quantity: n(invoice.tickets_count) || 1,
        unit_code: 'C62',
        unit_price_net: (n(invoice.tickets_count) || 1) > 0 ? vatBase / (n(invoice.tickets_count) || 1) : vatBase,
        line_total_net: vatBase,
        tax_percent: vatRate,
        tax_category: 'S',
        tax_category_name: oznakaStope,
        cpa_code: '50.10.11',
    }];

    const subtotals = [{
        taxable: vatBase, tax: vatAmount, percent: vatRate,
        category: 'S', category_name: oznakaStope,
    }];
    // HR raspodjela PDV (HR-BG-2) trazi se samo kad racun mijesa vise tretmana;
    // dok je pristojbe nema, racun je cisto oporeziv i dodatni blok nije potreban.
    const hrSubtotals = [];
    if (harborTax > 0) {
        items.push({
            name: 'Lučka pristojba',
            quantity: 1,
            unit_code: 'C62',
            unit_price_net: harborTax,
            line_total_net: harborTax,
            tax_percent: 0,
            tax_category: 'E',
            tax_category_name: OZNAKA_PROLAZNE,
            tax_exemption_reason: RAZLOG_PROLAZNE,
            cpa_code: '50.10.11',
        });
        // U standardnom dijelu racuna prolazna stavka nosi UNTDID oznaku E, a u
        // HR raspodjeli HR oznaku O — sifarnik ih za cl. 33 razlikuje.
        const prolazna = {
            taxable: harborTax, tax: 0, percent: 0,
            category: 'E', hr_category: 'O',
            category_name: OZNAKA_PROLAZNE, exemption_reason: RAZLOG_PROLAZNE,
        };
        subtotals.push(prolazna);
        hrSubtotals.push(subtotals[0], prolazna);
    }

    const issueDate = new Date(invoice.invoice_date || Date.now());
    const iso = issueDate.toISOString();
    const oznaka = invoice.partner_invoice_code
        || (invoice.partner_invoice_fiskal_no != null
            ? `${invoice.partner_invoice_fiskal_no}/${invoice.invoice_year || iso.slice(0, 4)}`
            : String(invoice.partner_invoice_no || invoice.partner_invoice_uuid).slice(0, 20));

    const ublXml = buildUblInvoice({
        invoice: {
            id: oznaka,
            issue_date: iso.slice(0, 10),
            issue_time: iso.slice(11, 19),
            due_date: iso.slice(0, 10),
            profile_id: 'P1',
            note: razdoblje ? `Zbirni racun za partnersku prodaju ${razdoblje}` : undefined,
        },
        supplier: {
            oib: company.legal_id || invoice.company_legal_id || '',
            name: company.name || invoice.company_name || '',
            address: company.address || invoice.company_address || '',
            town: company.town || invoice.company_town || '',
            postal_code: company.postal_code || invoice.company_postal_code || '',
            country: 'HR',
            email: company.email || '',
        },
        // Kupac je partner — racun ide njemu, on nama duguje.
        customer: {
            oib: invoice.partner_legal_id || invoice.partner_vat_id || '',
            name: invoice.partner_name || '',
            address: invoice.partner_address || '',
            town: invoice.partner_town || '',
            postal_code: invoice.partner_postal_code || '',
            country: invoice.partner_country || 'HR',
        },
        operator: {
            mark: invoice.billing_device_fiscal_mark || '',
            oib: company.legal_id || invoice.company_legal_id || '',
        },
        // Zbirni racun se placa transakcijskim racunom, ne na blagajni. Uz sifru
        // transfera racun mora nositi i IBAN primatelja, inace pada na BR-61.
        payment: { means_code: '30', iban: company.iban || invoice.company_iban || '' },
        items,
        totals: {
            line_total_net: lineTotalNet,
            tax_exclusive: lineTotalNet,
            tax: vatAmount,
            tax_inclusive: payable,
            payable,
            tax_percent: vatRate,
            tax_subtotals: subtotals,
        },
        // HR osnovica je bez prolaznih stavaka, pa se lucka pristojba iskazuje
        // odvojeno kao iznos izvan podrucja PDV-a.
        hr_extension: hrSubtotals.length ? {
            tax_subtotals: hrSubtotals,
            tax_exclusive_amount: vatBase,
            out_of_scope_amount: harborTax,
        } : undefined,
    });

    const fileName = `partner_invoice_${String(invoice.partner_invoice_uuid || Date.now()).slice(0, 20)}.xml`;
    const resp = await sendInvoice(ublXml, { fileName });
    return { ublXml, fileName, response: resp, payable };
};

module.exports = { sendPartnerInvoiceToYescor };
