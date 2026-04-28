const { getUsersController, addUserController, updateUserController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/usersServiceControllers")

const handleGetUsersFeature = async(req,res)=>{
    try {
        const usersData = await getUsersController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'users',
                data:usersData.data.users
            }
        })
    } catch (error) {
        
    }
}

const handleAddUsersFeature = async(req,res)=>{
    try {
        const addUsersData = await addUserController(req.body)
        const usersData = await getUsersController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'users',
                data:usersData.data.users
            }
        })
    } catch (error) {
        
    }
}

const handleUpdateUsersFeature = async(req,res)=>{
    try {
        const updateUserData = await updateUserController(req.body)
        const usersData = await getUsersController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'users',
                data:usersData.data.users
            }
        })
    } catch (error) {
        
    }
}

module.exports = {
    handleGetUsersFeature,
    handleAddUsersFeature,
    handleUpdateUsersFeature
}