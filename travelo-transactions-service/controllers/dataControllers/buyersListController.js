const { Op, fn, col } = require("sequelize");

// Vraća distinct listu kupaca (R1) iz invoices tablice — mobile koristi za adresar.
const listBuyersController = async (req, res) => {
    const { InvoiceModel } = req.app.locals.models;
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
        // Dohvati recentne fakture s buyer_oib-om, zatim dedupe-aj po OIB-u.
        const rows = await InvoiceModel.findAll({
            where: { buyer_oib: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
            attributes: [
                'buyer_oib', 'buyer_name', 'buyer_company_name',
                'buyer_address', 'buyer_postal_code', 'buyer_town',
                'buyer_email', 'createdAt',
            ],
            order: [['createdAt', 'DESC']],
            limit: limit * 3, // uzmi malo više pa dedup u memoriji
        });
        const byOib = new Map();
        for (const r of rows) {
            const oib = r.buyer_oib;
            if (!oib || byOib.has(oib)) continue;
            byOib.set(oib, {
                oib,
                name: r.buyer_name || r.buyer_company_name || '',
                address: r.buyer_address || '',
                postal_code: r.buyer_postal_code || '',
                town: r.buyer_town || '',
                email: r.buyer_email || '',
                last_used_at: r.createdAt || null,
            });
        }
        const buyers = Array.from(byOib.values()).slice(0, limit);
        res.status(200).json({ status: 200, data: { buyers, total: buyers.length } });
    } catch (error) {
        console.log("listBuyersController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { listBuyersController };
