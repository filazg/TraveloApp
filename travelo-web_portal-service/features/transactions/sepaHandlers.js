const {
    listSepaOrdersController,
    getSepaOrderController,
    createSepaOrderController,
    setSepaOrderStatusController,
    addSepaOrderItemController,
    deleteSepaOrderItemController,
} = require('../../controllers/coreServiceControllers/transactionsServiceControllers.js/sepaServiceControllers');

// Gateway zamota tijelo zahtjeva u { header, body } — POST rukovatelji zato
// moraju uzeti `body` ako postoji.
const tijelo = (req) => req.body?.body || req.body || {};

const handleGetSepaOrdersFeature = async (req, res) => {
    try {
        const raw = await listSepaOrdersController(req.query || {});
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'sepaOrders',
                data: { orders: raw?.data?.orders || [], total: raw?.data?.total || 0 },
            },
        });
    } catch (error) {
        console.log('handleGetSepaOrdersFeature error:', error?.message || error);
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetSepaOrderFeature = async (req, res) => {
    try {
        const raw = await getSepaOrderController(req.params.sepa_order_uuid);
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'sepaOrderDetails',
                data: { order: raw?.data?.order || null, items: raw?.data?.items || [] },
            },
        });
    } catch (error) {
        console.log('handleGetSepaOrderFeature error:', error?.message || error);
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleCreateSepaOrderFeature = async (req, res) => {
    const { status, body } = await createSepaOrderController(tijelo(req));
    res.status(status).send(body);
};

const handleSetSepaOrderStatusFeature = async (req, res) => {
    const { status, body } = await setSepaOrderStatusController(tijelo(req));
    res.status(status).send(body);
};

const handleAddSepaOrderItemFeature = async (req, res) => {
    const { status, body } = await addSepaOrderItemController(tijelo(req));
    res.status(status).send(body);
};

const handleDeleteSepaOrderItemFeature = async (req, res) => {
    const { status, body } = await deleteSepaOrderItemController(tijelo(req));
    res.status(status).send(body);
};

module.exports = {
    handleGetSepaOrdersFeature,
    handleGetSepaOrderFeature,
    handleCreateSepaOrderFeature,
    handleSetSepaOrderStatusFeature,
    handleAddSepaOrderItemFeature,
    handleDeleteSepaOrderItemFeature,
};
