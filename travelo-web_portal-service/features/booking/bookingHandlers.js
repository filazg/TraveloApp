const axios = require('axios');
const { getCoreServiceConfigData } = require('../../controllers/configServices/configSyncController');

const bookingUrl = async () => {
    const cfg = await getCoreServiceConfigData();
    const url = cfg?.services?.booking?.url;
    if (!url) throw new Error("booking service URL missing");
    return url;
};

const handleGetCapacityCategoriesFeature = async (req, res) => {
    try {
        const url = await bookingUrl();
        const resp = await axios.get(`${url}/capacity_categories`, { params: req.query, timeout: 10000 });
        const payload = resp.data?.data || { categories: [] };
        res.send({
            status: 200,
            data: { path1: 'bookingData', path2: 'categories', data: payload.categories || [] },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleAddCapacityCategoryFeature = async (req, res) => {
    try {
        const url = await bookingUrl();
        await axios.post(`${url}/capacity_categories`, req.body || {});
        const listResp = await axios.get(`${url}/capacity_categories`);
        res.send({
            status: 200,
            data: { path1: 'bookingData', path2: 'categories', data: listResp.data?.data?.categories || [] },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleUpdateCapacityCategoryFeature = async (req, res) => {
    try {
        const url = await bookingUrl();
        await axios.patch(`${url}/capacity_categories`, req.body || {});
        const listResp = await axios.get(`${url}/capacity_categories`);
        res.send({
            status: 200,
            data: { path1: 'bookingData', path2: 'categories', data: listResp.data?.data?.categories || [] },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetBookingsFeature = async (req, res) => {
    try {
        const url = await bookingUrl();
        const resp = await axios.get(`${url}/bookings`, { params: req.query, timeout: 10000 });
        const payload = resp.data?.data || { bookings: [] };
        res.send({
            status: 200,
            data: { path1: 'bookingData', path2: 'bookings', data: payload.bookings || [] },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleGetTicketTypeMappingsFeature = async (req, res) => {
    try {
        const url = await bookingUrl();
        const resp = await axios.get(`${url}/ticket_type_mappings`, { params: req.query, timeout: 10000 });
        const payload = resp.data?.data || { mappings: [] };
        res.send({
            status: 200,
            data: { path1: 'bookingData', path2: 'mappings', data: payload.mappings || [] },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleAddTicketTypeMappingFeature = async (req, res) => {
    try {
        const url = await bookingUrl();
        await axios.post(`${url}/ticket_type_mappings`, req.body || {});
        const listResp = await axios.get(`${url}/ticket_type_mappings`);
        res.send({
            status: 200,
            data: { path1: 'bookingData', path2: 'mappings', data: listResp.data?.data?.mappings || [] },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

const handleUpdateTicketTypeMappingFeature = async (req, res) => {
    try {
        const url = await bookingUrl();
        await axios.patch(`${url}/ticket_type_mappings`, req.body || {});
        const listResp = await axios.get(`${url}/ticket_type_mappings`);
        res.send({
            status: 200,
            data: { path1: 'bookingData', path2: 'mappings', data: listResp.data?.data?.mappings || [] },
        });
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message });
    }
};

module.exports = {
    handleGetCapacityCategoriesFeature,
    handleAddCapacityCategoryFeature,
    handleUpdateCapacityCategoryFeature,
    handleGetBookingsFeature,
    handleGetTicketTypeMappingsFeature,
    handleAddTicketTypeMappingFeature,
    handleUpdateTicketTypeMappingFeature,
};
