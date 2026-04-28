const getInvoiceDetailsController = async (req, res) => {
    const { InvoiceModel, InvoiceItemsModel, InvoiceItemDetailsModel } =
        req.app.locals.models;
    try {
        const invoice_uuid = req.params.invoice_uuid;
        if (!invoice_uuid) {
            return res.status(400).json({ status: 400, data: { message: "invoice_uuid required" } });
        }
        const invoice = await InvoiceModel.findOne({ where: { invoice_uuid } });
        if (!invoice) {
            return res.status(404).json({ status: 404, data: { message: "invoice not found" } });
        }
        const items = await InvoiceItemsModel.findAll({
            where: { invoice_uuid },
            order: [["id", "ASC"]],
        });
        const details = items.length
            ? await InvoiceItemDetailsModel.findAll({
                  where: { item_uuid: items.map((i) => i.item_uuid) },
                  order: [["id", "ASC"]],
              })
            : [];
        return res.status(200).json({
            status: 200,
            data: {
                invoice,
                items,
                details,
            },
        });
    } catch (error) {
        console.log("getInvoiceDetailsController error:", error);
        return res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { getInvoiceDetailsController };
