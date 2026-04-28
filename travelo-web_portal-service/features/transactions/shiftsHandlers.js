const { getShiftsController } = require('../../controllers/coreServiceControllers/transactionsServiceControllers.js/shiftsServiceControllers');

const handleGetShiftsFeature = async (req, res) => {
    try {
        const raw = await getShiftsController(req.query || {});
        // transactions-service vraća { status, data: [...shifts...] }
        const payload = Array.isArray(raw?.data) ? raw.data : [];
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'shifts',
                data: { shifts: payload },
            },
        });
    } catch (error) {
        console.log('handleGetShiftsFeature error:', error?.message || error);
        res.status(500).send({ status: 500, error: error.message });
    }
};

module.exports = { handleGetShiftsFeature };
