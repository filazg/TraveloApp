const { apiCancelOrder } = require("../../controllers/coreServiceControllers/transactionsServiceControllers");

const handleCancelOrderFeature = async (req, res) => {
    try {
        const { order_uuid, tickets, trip } = req.body || {};
        if (!order_uuid) {
            return res.status(400).json({ msg: "order_uuid required" });
        }
        const result = await apiCancelOrder({
            partner_uuid: req.partner.partner_uuid,
            order_uuid,
            tickets: Array.isArray(tickets) ? tickets : undefined,
            trip: trip || undefined,
        });
        if (!result || result.status !== 200) {
            return res.status(result?.status || 500).json(result?.data || { msg: "Could not cancel order" });
        }
        return res.status(200).json({
            msg: result.data.msg || "tickets canceled",
            return_amount: Number(result.data.return_amount || 0),
            canceled_tickets: result.data.canceled_tickets || [],
        });
    } catch (error) {
        console.log("cancelOrderFeature error:", error?.message || error);
        return res.status(500).json({ msg: "Internal error" });
    }
};

module.exports = { handleCancelOrderFeature };
