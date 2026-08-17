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
                data:usersData.data.users,
                // Ishod jezgre (npr. 208 kad oznaka ili šifra već postoje) — bez
                // ovoga portal uvijek dobije 200 i odbijeni unos izgleda kao uspjeh.
                result:{ status:addUsersData?.status, msg:addUsersData?.msg }
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
                data:usersData.data.users,
                result:{ status:updateUserData?.status, msg:updateUserData?.msg }
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