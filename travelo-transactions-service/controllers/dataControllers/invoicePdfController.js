const { renderTemplateToPdfBuffer } = require("../../helpers/pdfRenderer");

// Build the shape the legacy EJS template expects:
//   { invoice: { invoiceData, invoiceItemsData: [{...item, details:[{index,...}]}] } }
const buildTemplateData = (invoice, items, details) => {
    // invoice_date might be Date or string (Sequelize). Template calls
    // .getDate(), so normalize to Date here.
    const invoiceData = {
        ...invoice.toJSON ? invoice.toJSON() : invoice,
        invoice_date: new Date(invoice.invoice_date),
    };
    // Running line index across all items' details for the #-column in template.
    let idx = 0;
    const invoiceItemsData = items.map((item) => {
        const itemObj = item.toJSON ? item.toJSON() : item;
        const itemDetails = details
            .filter((d) => d.item_uuid === item.item_uuid)
            .map((d) => {
                const dObj = d.toJSON ? d.toJSON() : d;
                idx += 1;
                return { ...dObj, index: idx };
            });
        return { ...itemObj, details: itemDetails };
    });
    return { invoice: { invoiceData, invoiceItemsData } };
};

const loadInvoiceData = async ({ InvoiceModel, InvoiceItemsModel, InvoiceItemDetailsModel, invoice_uuid }) => {
    const invoice = await InvoiceModel.findOne({ where: { invoice_uuid } });
    if (!invoice) return null;
    const items = await InvoiceItemsModel.findAll({ where: { invoice_uuid } });
    const details = await InvoiceItemDetailsModel.findAll({
        where: { item_uuid: items.map((i) => i.item_uuid) },
    });
    return { invoice, items, details };
};

const buildInvoicePdfBuffer = async ({ models, invoice_uuid }) => {
    const data = await loadInvoiceData({ ...models, invoice_uuid });
    if (!data) return null;
    const tplData = buildTemplateData(data.invoice, data.items, data.details);
    return renderTemplateToPdfBuffer("invoiceTamplate.ejs", tplData);
};

const renderInvoicePdfController = async (req, res) => {
    const models = req.app.locals.models;
    try {
        const invoice_uuid = req.params.invoice_uuid || req.query.invoice_uuid;
        if (!invoice_uuid) return res.status(400).send("invoice_uuid required");

        const data = await loadInvoiceData({ ...models, invoice_uuid });
        if (!data) return res.status(404).send("Invoice not found");

        const tplData = buildTemplateData(data.invoice, data.items, data.details);
        const buffer = await renderTemplateToPdfBuffer("invoiceTamplate.ejs", tplData);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="invoice-${invoice_uuid.slice(0, 8)}.pdf"`
        );
        return res.end(buffer);
    } catch (error) {
        console.log("renderInvoicePdfController error:", error);
        return res.status(500).send("Invoice PDF generation failed");
    }
};

module.exports = { renderInvoicePdfController, buildInvoicePdfBuffer };
