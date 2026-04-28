const { getAddressbookController, addAddressbookController, updateAddressbookController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/addressbookServiceControllers")

const handleGetAddressbookFeature = async(req,res)=>{
    try {
        console.log('TU SMO PARTNER')
        const addressbookData = await getAddressbookController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'addressbook',
                data:addressbookData.data.addressbook
            }
        })
    } catch (error) {
         res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleAddAddressbookFeature = async(req,res)=>{
    try {
        const addAddressbookData = await addAddressbookController(req.body)
        const addressbookData = await getAddressbookController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'addressbook',
                data:addressbookData.data.addressbook
            }
        })
    } catch (error) {
         res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

const handleUpdateAddressbookFeature = async(req,res)=>{
    try {
        const updateAddressbookData = await updateAddressbookController(req.body)
        const addressbookData = await getAddressbookController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'addressbook',
                data:addressbookData.data.addressbook
            }
        })
    } catch (error) {
         res.status(500).send({
            status: 500,
            error: error.message
        })
    }
}

module.exports = {
    handleGetAddressbookFeature,
    handleAddAddressbookFeature,
    handleUpdateAddressbookFeature
}