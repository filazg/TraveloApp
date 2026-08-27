const {
    listPaymentOrdersController,
    getPaymentOrderController,
    getPaymentOrderXmlController,
    createPaymentOrderController,
    setPaymentOrderStatusController,
    addPaymentOrderItemController,
    deletePaymentOrderItemController,
} = require('../../controllers/coreServiceControllers/transactionsServiceControllers.js/paymentOrderServiceControllers');

// Gateway zamota tijelo zahtjeva u { header, body } — POST rukovatelji zato
// moraju uzeti `body` ako postoji.
const tijelo = (req) => req.body?.body || req.body || {};

const handleGetPaymentOrdersFeature = async (req, res) => {
    try {
        const raw = await listPaymentOrdersController(req.query || {});
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'paymentOrders',
                data: { orders: raw?.data?.orders || [], total: raw?.data?.total || 0 },
            },
        });
    } catch (error) {
        console.log('handleGetPaymentOrdersFeature error:', error?.message || error);
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetPaymentOrderFeature = async (req, res) => {
    try {
        const raw = await getPaymentOrderController(req.params.payment_order_uuid);
        res.send({
            status: 200,
            data: {
                path1: 'financeData',
                path2: 'paymentOrderDetails',
                data: { order: raw?.data?.order || null, items: raw?.data?.items || [] },
            },
        });
    } catch (error) {
        console.log('handleGetPaymentOrderFeature error:', error?.message || error);
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetPaymentOrderXmlFeature = async (req, res) => {
    try {
        const response = await getPaymentOrderXmlController(req.params.payment_order_uuid, req.query || {});
        res.status(response.status);
        // Greška iz servisa je JSON, a ne datoteka — zaglavlja se onda ne
        // postavljaju, inače bi preglednik ponudio spremanje poruke o grešci.
        if (response.status !== 200) {
            const tekst = Buffer.from(response.data).toString('utf8');
            try {
                return res.json(JSON.parse(tekst));
            } catch {
                return res.send(tekst);
            }
        }
        res.setHeader('content-type', response.headers['content-type'] || 'application/xml; charset=utf-8');
        if (response.headers['content-disposition']) {
            res.setHeader('content-disposition', response.headers['content-disposition']);
        }
        return res.send(Buffer.from(response.data));
    } catch (error) {
        console.log('handleGetPaymentOrderXmlFeature error:', error?.message || error);
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleCreatePaymentOrderFeature = async (req, res) => {
    const { status, body } = await createPaymentOrderController(tijelo(req));
    res.status(status).send(body);
};

const handleSetPaymentOrderStatusFeature = async (req, res) => {
    const { status, body } = await setPaymentOrderStatusController(tijelo(req));
    res.status(status).send(body);
};

const handleAddPaymentOrderItemFeature = async (req, res) => {
    const { status, body } = await addPaymentOrderItemController(tijelo(req));
    res.status(status).send(body);
};

const handleDeletePaymentOrderItemFeature = async (req, res) => {
    const { status, body } = await deletePaymentOrderItemController(tijelo(req));
    res.status(status).send(body);
};

module.exports = {
    handleGetPaymentOrdersFeature,
    handleGetPaymentOrderFeature,
    handleGetPaymentOrderXmlFeature,
    handleCreatePaymentOrderFeature,
    handleSetPaymentOrderStatusFeature,
    handleAddPaymentOrderItemFeature,
    handleDeletePaymentOrderItemFeature,
};
