// UBL 2.1 Invoice XML generator za YesCor Exchange Hub (HR F2).
// Prati EN 16931 / Peppol BIS Billing 3.0 osnovu; proširit će se s HR-specific
// extensijama kad bude potrebno.
//
// Input: plain object s invoice/supplier/customer/items/totals poljima (vidi
// buildUblInvoice jsdoc).
// Output: UBL 2.1 XML string (bez BOM-a, UTF-8).

const xmlEscape = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const n2 = (v) => (Number(v) || 0).toFixed(2);
const n4 = (v) => (Number(v) || 0).toFixed(4);

// Emitiraj element samo ako ima sadržaj (HR-BR-33 ne dozvoljava prazne XML elemente).
const tag = (name, value, attrs = '') => {
    const v = value == null ? '' : String(value).trim();
    if (!v) return '';
    const attrStr = attrs ? ' ' + attrs : '';
    return `<${name}${attrStr}>${xmlEscape(v)}</${name}>`;
};

const supplierBlock = (s, op = {}) => {
    const addrInner = [
        tag('cbc:StreetName', s.address),
        tag('cbc:CityName', s.town),
        tag('cbc:PostalZone', s.postal_code),
        `<cac:Country>${tag('cbc:IdentificationCode', s.country || 'HR')}</cac:Country>`,
    ].filter(Boolean).join('\n          ');
    const contactInner = tag('cbc:ElectronicMail', s.email);
    return `
    <cac:AccountingSupplierParty>
      <cac:Party>
        ${tag('cbc:EndpointID', s.oib, 'schemeID="9934"')}
        <cac:PartyName>${tag('cbc:Name', s.name)}</cac:PartyName>
        ${addrInner ? `<cac:PostalAddress>
          ${addrInner}
        </cac:PostalAddress>` : ''}
        <cac:PartyTaxScheme>
          ${tag('cbc:CompanyID', (s.country || 'HR') + (s.oib || ''))}
          <cac:TaxScheme>${tag('cbc:ID', 'VAT')}</cac:TaxScheme>
        </cac:PartyTaxScheme>
        <cac:PartyLegalEntity>
          ${tag('cbc:RegistrationName', s.name)}
          ${tag('cbc:CompanyID', s.oib)}
        </cac:PartyLegalEntity>
        ${contactInner ? `<cac:Contact>${contactInner}</cac:Contact>` : ''}
      </cac:Party>
      ${op.mark || op.oib ? `<cac:SellerContact>
        ${tag('cbc:ID', op.oib)}
        ${tag('cbc:Name', op.mark)}
      </cac:SellerContact>` : ''}
    </cac:AccountingSupplierParty>`;
};

const customerBlock = (c) => {
    const addrInner = [
        tag('cbc:StreetName', c.address),
        tag('cbc:CityName', c.town),
        tag('cbc:PostalZone', c.postal_code),
        `<cac:Country>${tag('cbc:IdentificationCode', c.country || 'HR')}</cac:Country>`,
    ].filter(Boolean).join('\n          ');
    return `
    <cac:AccountingCustomerParty>
      <cac:Party>
        ${tag('cbc:EndpointID', c.oib, 'schemeID="9934"')}
        <cac:PartyName>${tag('cbc:Name', c.name)}</cac:PartyName>
        ${addrInner ? `<cac:PostalAddress>
          ${addrInner}
        </cac:PostalAddress>` : ''}
        <cac:PartyTaxScheme>
          ${tag('cbc:CompanyID', (c.country || 'HR') + (c.oib || ''))}
          <cac:TaxScheme>${tag('cbc:ID', 'VAT')}</cac:TaxScheme>
        </cac:PartyTaxScheme>
        <cac:PartyLegalEntity>
          ${tag('cbc:RegistrationName', c.name)}
          ${tag('cbc:CompanyID', c.oib)}
        </cac:PartyLegalEntity>
      </cac:Party>
    </cac:AccountingCustomerParty>`;
};

// Redoslijed djece TaxCategory je propisan UBL shemom: ID, Name, Percent,
// TaxExemptionReason, TaxScheme. Zamjena mjesta obara validaciju.
// Name nosi HR oznaku kategorije PDV-a (HR-BT-12, npr. "HR:PDV25", "HR:CL33"),
// TaxExemptionReason razlog oslobodenja (HR-BT-13) — oboje obavezno za svaku
// stavku koja ne podlijeze PDV-u ili je oslobodena.
// Ekstenzija ima svoja imena elemenata (HRTaxCategory / HRTaxScheme), pa se
// isti blok gradi s drugim omotacima; sadrzaj je jednak.
const taxCategoryBlock = (st, indent, el = 'cac:TaxCategory', schemeEl = 'cac:TaxScheme') => `${indent}<${el}>
${indent}  <cbc:ID>${xmlEscape(st.category || 'S')}</cbc:ID>
${indent}  ${st.category_name ? tag('cbc:Name', st.category_name) : ''}
${indent}  <cbc:Percent>${n2(st.percent)}</cbc:Percent>
${indent}  ${st.exemption_reason ? tag('cbc:TaxExemptionReason', st.exemption_reason) : ''}
${indent}  <${schemeEl}><cbc:ID>${xmlEscape(st.tax_scheme || 'VAT')}</cbc:ID></${schemeEl}>
${indent}</${el}>`;

const taxSubtotalBlock = (st) => `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="EUR">${n2(st.taxable)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="EUR">${n2(st.tax)}</cbc:TaxAmount>
${taxCategoryBlock(st, '        ')}
      </cac:TaxSubtotal>`;

// Racun s vise poreznih tretmana treba po jedan TaxSubtotal za svaki. Partnerski
// racun je takav: usluga prijevoza je oporeziva, a lucka pristojba je prolazna
// stavka oslobodena PDV-a, pa se ne smije zbrojiti u istu osnovicu.
//
// subtotals se prosljeduje samo kad ih ima vise; bez njega ostaje jedan blok,
// tocno kakav je bio — racuni s blagajne i weba ne mijenjaju svoj XML.
const taxTotalBlock = ({ taxable, tax, taxPercent, subtotals }) => {
    const redci = Array.isArray(subtotals) && subtotals.length
        ? subtotals
        : [{ taxable, tax, percent: taxPercent, category: 'S' }];
    const ukupno = redci.reduce((z, r) => z + (Number(r.tax) || 0), 0);
    return `
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="EUR">${n2(ukupno)}</cbc:TaxAmount>
${redci.map(taxSubtotalBlock).join('')}
    </cac:TaxTotal>`;
};

const invoiceLineBlock = (l, index) => `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${xmlEscape(l.unit_code || 'C62')}">${n2(l.quantity)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="EUR">${n2(l.line_total_net)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${xmlEscape(l.name)}</cbc:Name>
        <cac:CommodityClassification>
          <cbc:ItemClassificationCode listID="CG">${xmlEscape(l.cpa_code || '50.10.11')}</cbc:ItemClassificationCode>
        </cac:CommodityClassification>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${xmlEscape(l.tax_category || 'S')}</cbc:ID>
          ${l.tax_category_name ? tag('cbc:Name', l.tax_category_name) : ''}
          <cbc:Percent>${n2(l.tax_percent)}</cbc:Percent>
          ${l.tax_exemption_reason ? tag('cbc:TaxExemptionReason', l.tax_exemption_reason) : ''}
          <cac:TaxScheme><cbc:ID>${xmlEscape(l.tax_scheme || 'VAT')}</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="EUR">${n4(l.unit_price_net)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;

/**
 * Build UBL 2.1 Invoice XML.
 *
 * @param {object} data
 *   .invoice       { id, issue_date (YYYY-MM-DD), due_date, buyer_reference, note }
 *   .supplier      { oib, name, address, town, postal_code, country, email }
 *   .customer      { oib, name, address, town, postal_code, country }
 *   .payment       { means_code: '10' cash / '48' card / '30' transfer, iban? (obavezan uz '30') }
 *   .hr_extension  { tax_subtotals?: [{ taxable, tax, percent, category, category_name, exemption_reason }],
 *                    tax_exclusive_amount?, out_of_scope_amount? }
 *   .items         [{ name, quantity, unit_code, unit_price_net, line_total_net, tax_percent, tax_category }]
 *   .totals        { line_total_net, tax_exclusive, tax, tax_inclusive, payable, tax_percent,
 *                    tax_subtotals?: [{ taxable, tax, percent, category, exemption_reason }] }
 */
function buildUblInvoice(data) {
    const inv = data.invoice || {};
    const sup = data.supplier || {};
    const cus = data.customer || {};
    const pay = data.payment || { means_code: '10' };
    const items = Array.isArray(data.items) ? data.items : [];
    const tot = data.totals || {};

    // HR CIUS 2025 extension — HRFISK20Data sadrži HR-specific tax blocks
    // (nije za operator info — operator ide u supplier PartyIdentification).
    // Za sada prazan extension sa samo HRTaxTotal placeholder-om.
    const op = data.operator || {};
    // HR raspodjela PDV (HR-BG-2) i HR ukupni iznosi (HR-BG-3). Traze se cim
    // racun mijesa vise poreznih tretmana — npr. oporeziva usluga plus prolazna
    // stavka. HRTaxExclusiveAmount je osnovica BEZ prolaznih stavaka, a
    // OutOfScopeOfVATAmount njihov zbroj; bez njih racun tvrdi da je sve u
    // osnovici i pada na HR-BR-26.
    const hrx = data.hr_extension || {};
    const hrSubtotals = Array.isArray(hrx.tax_subtotals) ? hrx.tax_subtotals : [];
    // Shema trazi omotac HRTaxTotal oko podzbrojeva. Kategorija se u ekstenziji
    // vodi HR oznakom (HRBT-18) koja se za prolazne stavke razlikuje od UNTDID
    // oznake u standardnom dijelu: stavka je tamo E, ovdje O.
    const hrUkupniPdv = hrSubtotals.reduce((z, st) => z + (Number(st.tax) || 0), 0);
    const hrRaspodjela = hrSubtotals.length ? `
          <hrextac:HRTaxTotal>
            <cbc:TaxAmount currencyID="EUR">${n2(hrUkupniPdv)}</cbc:TaxAmount>${hrSubtotals.map((st) => `
            <hrextac:HRTaxSubtotal>
              <cbc:TaxableAmount currencyID="EUR">${n2(st.taxable)}</cbc:TaxableAmount>
              <cbc:TaxAmount currencyID="EUR">${n2(st.tax)}</cbc:TaxAmount>
${taxCategoryBlock({ ...st, category: st.hr_category || st.category }, '              ', 'hrextac:HRTaxCategory', 'hrextac:HRTaxScheme')}
            </hrextac:HRTaxSubtotal>`).join('')}
          </hrextac:HRTaxTotal>` : '';
    const hrIznosi = (hrx.tax_exclusive_amount != null || hrx.out_of_scope_amount != null) ? `
          <hrextac:HRLegalMonetaryTotal>
            <cbc:TaxExclusiveAmount currencyID="EUR">${n2(hrx.tax_exclusive_amount)}</cbc:TaxExclusiveAmount>
            <hrextac:OutOfScopeOfVATAmount currencyID="EUR">${n2(hrx.out_of_scope_amount)}</hrextac:OutOfScopeOfVATAmount>
          </hrextac:HRLegalMonetaryTotal>` : '';
    const hrExtension = `
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:mfin.gov.hr:ext-2025:1.0</ext:ExtensionURI>
      <ext:ExtensionContent>
        <hrextac:HRFISK20Data>
          <hrextac:HRObracunPDVPoNaplati>false</hrextac:HRObracunPDVPoNaplati>${hrRaspodjela}${hrIznosi}
        </hrextac:HRFISK20Data>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
         xmlns:hrextac="urn:mfin.gov.hr:schema:xsd:HRExtensionAggregateComponents-1">
${hrExtension}
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:mfin.gov.hr:cius-2025:1.0#conformant#urn:mfin.gov.hr:ext-2025:1.0</cbc:CustomizationID>
  <cbc:ProfileID>${xmlEscape(inv.profile_id || 'P1')}</cbc:ProfileID>
  <cbc:ID>${xmlEscape(inv.id)}</cbc:ID>
  <cbc:IssueDate>${xmlEscape(inv.issue_date)}</cbc:IssueDate>
  <cbc:IssueTime>${xmlEscape(inv.issue_time || '00:00:00')}</cbc:IssueTime>
  <cbc:DueDate>${xmlEscape(inv.due_date || inv.issue_date)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  ${inv.note ? `<cbc:Note>${xmlEscape(inv.note)}</cbc:Note>` : ''}
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  ${inv.buyer_reference ? `<cbc:BuyerReference>${xmlEscape(inv.buyer_reference)}</cbc:BuyerReference>` : ''}
${supplierBlock(sup, data.operator)}
${customerBlock(cus)}
    <cac:PaymentMeans>
      <cbc:PaymentMeansCode>${xmlEscape(pay.means_code || '10')}</cbc:PaymentMeansCode>
      ${pay.iban ? `<cac:PayeeFinancialAccount>${tag('cbc:ID', pay.iban)}</cac:PayeeFinancialAccount>` : ''}
    </cac:PaymentMeans>
${taxTotalBlock({ taxable: tot.tax_exclusive, tax: tot.tax, taxPercent: tot.tax_percent, subtotals: tot.tax_subtotals })}
    <cac:LegalMonetaryTotal>
      <cbc:LineExtensionAmount currencyID="EUR">${n2(tot.line_total_net)}</cbc:LineExtensionAmount>
      <cbc:TaxExclusiveAmount currencyID="EUR">${n2(tot.tax_exclusive)}</cbc:TaxExclusiveAmount>
      <cbc:TaxInclusiveAmount currencyID="EUR">${n2(tot.tax_inclusive)}</cbc:TaxInclusiveAmount>
      <cbc:PayableAmount currencyID="EUR">${n2(tot.payable)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
${items.map(invoiceLineBlock).join('\n')}
</Invoice>`;
    return xml;
}

module.exports = { buildUblInvoice };
