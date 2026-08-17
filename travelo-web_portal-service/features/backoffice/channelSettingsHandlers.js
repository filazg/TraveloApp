const {
    getChannelSettingsController,
    getChannelSettingController,
    upsertChannelSettingController,
} = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/channelSettingsServiceControllers")

// Postavke izdavanja računa po prodajnom kanalu (web, partner).
const handleGetChannelSettingsFeature = async (req, res) => {
    try {
        const result = await getChannelSettingsController()
        res.send({
            status: 200,
            data: {
                path1: 'backofficeData',
                path2: 'channel_settings',
                data: result?.data?.channel_settings || [],
            },
        })
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message })
    }
}

const handleGetChannelSettingFeature = async (req, res) => {
    try {
        const result = await getChannelSettingController(req.params.channel)
        res.send({ status: result?.status || 200, data: result?.data || null })
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message })
    }
}

const handleUpsertChannelSettingFeature = async (req, res) => {
    try {
        const result = await upsertChannelSettingController(req.params.channel, req.body)
        res.send({ status: result?.status || 200, data: result?.data || null })
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message })
    }
}

module.exports = {
    handleGetChannelSettingsFeature,
    handleGetChannelSettingFeature,
    handleUpsertChannelSettingFeature,
}
