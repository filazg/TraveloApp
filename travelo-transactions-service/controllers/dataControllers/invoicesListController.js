const { Op } = require("sequelize");

const listInvoicesController = async (req, res) => {
    const { InvoiceModel } = req.app.locals.models;
    try {
        const where = {};
        if (req.query.invoice_status) where.invoice_status = req.query.invoice_status;
        if (req.query.buyer_email) {
            where.buyer_email = { [Op.iLike]: `%${req.query.buyer_email}%` };
        }
        if (req.query.buyer_name) {
            where.buyer_name = { [Op.iLike]: `%${req.query.buyer_name}%` };
        }
        if (req.query.buyer_company_name) {
            where.buyer_company_name = { [Op.iLike]: `%${req.query.buyer_company_name}%` };
        }
        if (req.query.invoice_code) {
            where.invoice_code = { [Op.iLike]: `%${req.query.invoice_code}%` };
        }
        if (req.query.billing_device_uuid) {
            where.invoice_billing_device_uuid = req.query.billing_device_uuid;
        }
        if (req.query.operator_uuid) {
            where.operater_uuid = req.query.operator_uuid;
        }

        // Year (+ optional month) shortcut. Without month → whole year.
        if (req.query.year) {
            const y = parseInt(req.query.year, 10);
            const m = req.query.month ? parseInt(req.query.month, 10) : null;
            if (y && m) {
                const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
                const to = new Date(Date.UTC(y, m, 1, 0, 0, 0) - 1);
                where.invoice_date = { [Op.gte]: from, [Op.lte]: to };
            } else if (y) {
                const from = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
                const to = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0) - 1);
                where.invoice_date = { [Op.gte]: from, [Op.lte]: to };
            }
        } else if (req.query.date_from || req.query.date_to) {
            where.invoice_date = {};
            if (req.query.date_from) where.invoice_date[Op.gte] = new Date(req.query.date_from);
            if (req.query.date_to) {
                const to = new Date(req.query.date_to);
                to.setHours(23, 59, 59, 999);
                where.invoice_date[Op.lte] = to;
            }
        }

        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const offset = parseInt(req.query.offset, 10) || 0;

        const result = await InvoiceModel.findAndCountAll({
            where,
            limit,
            offset,
            order: [["id", "DESC"]],
            // Return the full invoice row — company_*, buyer_*, fiscal marks etc.
            // Items/details are still fetched on demand via GET /invoice/:uuid.
        });

        return res.status(200).json({
            status: 200,
            data: { invoices: result.rows, total: result.count, limit, offset },
        });
    } catch (error) {
        console.log("listInvoicesController error:", error);
        return res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { listInvoicesController };
