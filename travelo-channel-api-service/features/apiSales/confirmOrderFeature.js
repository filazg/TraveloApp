const { apiConfirmOrder } = require("../../controllers/coreServiceControllers/transactionsServiceControllers");

const handleConfirmOrderFeature = async (req, res) => {
    try {
        const { order_uuid } = req.body || {};
        if (!order_uuid) {
            return res.status(400).json({ msg: "order_uuid required" });
        }
        const result = await apiConfirmOrder({
            partner_uuid: req.partner.partner_uuid,
            order_uuid,
        });
        if (!result || result.status !== 200) {
            return res.status(result?.status || 500).json(result?.data || { msg: "Could not confirm order" });
        }
        return res.status(200).json({ tickets: result.data.tickets || [] });
    } catch (error) {
        console.log("confirmOrderFeature error:", error?.message || error);
        return res.status(500).json({ msg: "Internal error" });
    }
};

module.exports = { handleConfirmOrderFeature };
