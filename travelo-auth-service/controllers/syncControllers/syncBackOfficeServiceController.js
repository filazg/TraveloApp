const axios = require('axios')
const { getModels } = require("../../dbModels");
const { getCoreServiceConfigData } = require("../configSyncController");


const syncUsersDataController = async()=>{
    try {
        const { UsersModel,UsersPermissionsModel } = getModels();
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.get(coreConfigData.services.backoffice.url + '/users')
        await UsersModel.truncate()
        await UsersModel.bulkCreate(response.data.data.users)
        let permissionsToAdd = []
        for(const userData of response.data.data.users){
            if(userData.is_active){
                permissionsToAdd = [...permissionsToAdd, ...userData.permissions]
            }
        }
        await UsersPermissionsModel.truncate()
        await UsersPermissionsModel.bulkCreate(permissionsToAdd)
        return         
    } catch (error) {
        console.log(error)
    }
}

const syncTerminalsDataController = async()=>{
    try {
        const { TerminalsModel } = getModels();
        const coreConfigData = await getCoreServiceConfigData() 
        const response = await axios.get(coreConfigData.services.backoffice.url + '/billing_devices')
        await TerminalsModel.truncate()
        await TerminalsModel.bulkCreate(response.data.data.billing_devices)
        return
    } catch (error) {
        console.log(error)
    }
}

const syncPartnersWebUsersDataController = async () => {
    try {
        const { PartnersWebUsersModel } = getModels();
        const coreConfigData = await getCoreServiceConfigData();
        const response = await axios.get(coreConfigData.services.backoffice.url + '/partners_web_users');
        await PartnersWebUsersModel.truncate();
        const rows = response.data?.data?.partners_web_users || [];
        if (rows.length) await PartnersWebUsersModel.bulkCreate(rows);
    } catch (error) {
        console.log('syncPartnersWebUsersDataController error:', error?.message || error);
    }
};

module.exports = {
    syncUsersDataController,
    syncTerminalsDataController,
    syncPartnersWebUsersDataController,
}