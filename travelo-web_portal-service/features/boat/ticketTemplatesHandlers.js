const axios = require('axios');
const { getCoreServiceConfigData } = require('../../controllers/configServices/configSyncController');

// Predlošci PDF karte.
//
// Postavka (koji je predložak izabran po kanalu) živi u boat servisu, a katalog
// dostupnih predložaka u transactions servisu, koji ih i crta. Portal treba oboje
// pa se ovdje spajaju u jedan odgovor — inače bi sučelje moralo znati koji
// servis drži koji dio, a to znanje mu ne pripada.
const handleGetTicketTemplatesFeature = async (req, res) => {
    try {
        const core = await getCoreServiceConfigData();
        const boatUrl = core?.services?.boat?.url;
        const trxUrl = core?.services?.transactions?.url;

        const [postavke, katalog] = await Promise.all([
            boatUrl
                ? axios.get(`${boatUrl}/ticket_templates`, { timeout: 10000, validateStatus: () => true })
                : Promise.resolve(null),
            trxUrl
                ? axios.get(`${trxUrl}/ticket_template_catalog`, { timeout: 10000, validateStatus: () => true })
                : Promise.resolve(null),
        ]);

        res.send({
            status: 200,
            data: {
                path1: 'boatData',
                path2: 'ticketTemplates',
                data: {
                    templates: postavke?.data?.data?.templates || [],
                    catalog: katalog?.data?.data?.templates || [],
                    channels: katalog?.data?.data?.channels || [],
                },
            },
        });
    } catch (error) {
        console.log('handleGetTicketTemplatesFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const handleUpsertTicketTemplateFeature = async (req, res) => {
    try {
        const core = await getCoreServiceConfigData();
        const boatUrl = core?.services?.boat?.url;
        if (!boatUrl) return res.status(500).send({ status: 500, data: { message: 'boat URL nije postavljen' } });
        const r = await axios.post(`${boatUrl}/ticket_templates`, req.body?.body || req.body || {}, {
            timeout: 10000,
            validateStatus: () => true,
        });
        res.status(r.status).send(r.data);
    } catch (error) {
        console.log('handleUpsertTicketTemplateFeature error:', error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { handleGetTicketTemplatesFeature, handleUpsertTicketTemplateFeature };
