const { provjeriPPP } = require('./provjeriPPP');

const provjeriPPPController = async (req, res) => {
    try {
        const result = await provjeriPPP(req.body || {});
        res.json({ status: 200, data: result });
    } catch (err) {
        const detail = err?.code ? { code: err.code } : {};
        console.log('provjeriPPP error:', err?.message || err, detail);
        res.status(500).json({ status: 500, data: { message: err.message, ...detail } });
    }
};

module.exports = { provjeriPPPController };
