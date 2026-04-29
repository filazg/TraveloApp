const { apiCreateOrder } = require("../../controllers/coreServiceControllers/transactionsServiceControllers");

const handleOrderFeature = async (req, res) => {
    try {
        const { order_number, order_items } = req.body || {};
        if (!order_number || !Array.isArray(order_items) || !order_items.length) {
            return res.status(400).json({ msg: "order_number/order_items required" });
        }

        const subtotal = order_items.reduce((sum, item) => sum + Number(item.total_item_price || 0), 0);

        const result = await apiCreateOrder({
            partner_uuid: req.partner.partner_uuid,
            api_user_uuid: req.partner.api_user_uuid,
            order_number,
            order_items,
            total_amount: subtotal,
        });

        if (!result || result.status !== 200) {
            return res.status(result?.status || 500).json(result?.data || { msg: "Could not create order" });
        }

        return res.status(200).json({
            msg: "order created",
            order_uuid: result.data.order_uuid,
            order_number,
            order_items,
        });
    } catch (error) {
        console.log("orderFeature error:", error?.message || error);
        return res.status(500).json({ msg: "Internal error" });
    }
};

module.exports = { handleOrderFeature };
