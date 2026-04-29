const axios = require('axios');
const { getMainServiceConfigData } = require("../configServices/configSyncController");

const apiPartnerLogin = async ({ tid, otp }) => {
    const mainConfig = getMainServiceConfigData();
    const url = mainConfig.services.auth.url + '/login/apiPartnerLogin';
    const response = await axios.post(url, { tid, otp });
    return response;
};

module.exports = {
    apiPartnerLogin,
};
