const axios = require('axios');
const { getCoreServiceConfigData } = require('../configSyncController');

const getCountriesController = async (req, res) => {
    try {
        const coreConfigData = await getCoreServiceConfigData();
        const backofficeUrl = coreConfigData?.services?.backoffice?.url;
        if (!backofficeUrl) {
            return res.status(500).send({ status: 500, data: { countries: [] } });
        }
        const response = await axios.get(`${backofficeUrl}/countries`, {
            params: { only_active: "true" },
            timeout: 5000,
        });
        res.send({
            status: 200,
            data: { countries: response.data?.data?.countries || [] },
        });
    } catch (error) {
        console.log('getCountriesController error:', error?.message || error);
        res.status(500).send({ status: 500, data: { countries: [] } });
    }
};

module.exports = { getCountriesController };
