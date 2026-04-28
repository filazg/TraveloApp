const updateOrdersStatusController = async (req, res) => {
    const { OrdersModel } = req.app.locals.models;
    try {
        const body = req.body || {};
        const { payment_reference, status, order_uuid } = body;

        if (!status) {
            return res.status(400).json({ status: 400, data: { message: "status required" } });
        }
        if (!payment_reference && !order_uuid) {
            return res.status(400).json({ status: 400, data: { message: "payment_reference or order_uuid required" } });
        }

        const where = {};
        if (payment_reference) where.payment_reference = payment_reference;
        if (order_uuid) where.uuid = order_uuid;

        const fields = { status, payment_status_meta: body.meta || null };
        if (body.invoice_uuid) fields.invoice_uuid = body.invoice_uuid;
        const [affected] = await OrdersModel.update(fields, { where });

        res.status(200).json({
            status: 200,
            data: { affected, where, new_status: status },
        });
    } catch (error) {
        console.log("updateOrdersStatusController error:", error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { updateOrdersStatusController };
