const axios = require('axios')
const { getCoreServiceConfigData } = require('../../configServices/configSyncController')
const { travelo_publisher } = require('../../publisherController')

const getUsersController = async()=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.get(coreConfigData.services.backoffice.url + '/users')
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}
const addUserController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.post(coreConfigData.services.backoffice.url + '/users', data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

const updateUserController = async(data)=>{
    try {
        const coreConfigData = await getCoreServiceConfigData() 
        console.log(coreConfigData)
        const response = await axios.patch(coreConfigData.services.backoffice.url + '/users', data)
        await travelo_publisher('travelo_auth_service', {path:'update_users'})
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getUsersController,
    addUserController,
    updateUserController
}