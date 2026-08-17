const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')

const backofficeBase = async () => {
    const cfg = await getCoreServiceConfigData()
    return cfg.services.backoffice.url
}

const getChannelSettingsController = async () => {
    const response = await axios.get((await backofficeBase()) + '/channel_settings')
    return (response.data)
}

const getChannelSettingController = async (channel) => {
    const response = await axios.get((await backofficeBase()) + '/channel_settings/' + channel)
    return (response.data)
}

const upsertChannelSettingController = async (channel, data) => {
    const response = await axios.patch((await backofficeBase()) + '/channel_settings/' + channel, data)
    return (response.data)
}

module.exports = {
    getChannelSettingsController,
    getChannelSettingController,
    upsertChannelSettingController,
}
