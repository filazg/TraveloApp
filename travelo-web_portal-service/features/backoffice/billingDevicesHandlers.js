const { getBillingDevicesController, addBillingDevicesController, updateBillingDevicesController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/billingDevicesServiceControllers")
const { getBusinessPremisesController, addBusinessPremisesController, updateBusinessPremisesController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/businessPremisesServiceControllers")

const handleGetBillingDevicesFeature = async(req,res)=>{
    try {
        const billingDevicesData = await getBillingDevicesController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'billing_devices',
                data:billingDevicesData.data.billing_devices
            }
        })
    } catch (error) {
        res.status(500).send({
            status:500,
            error:error.message
        })
    }
}

const handleAddBillingDevicesFeature = async(req,res)=>{
    try {
        const addBillingDevicesData = await addBillingDevicesController(req.body)
        const billingDevicesData = await getBillingDevicesController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'billing_devices',
                data:billingDevicesData.data.billing_devices
            }
        })
    } catch (error) {
        res.status(500).send({
            status:500,
            error:error.message
        })
    }
}

const handleUpdateBillingDevicesFeature = async(req,res)=>{
    try {
        console.log('Updating billing devices with data:', req.body);
        const updateBillingDevicesData = await updateBillingDevicesController(req.body)
        const billingDevicesData = await getBillingDevicesController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'billing_devices',
                data:billingDevicesData.data.billing_devices
            }
        })
    } catch (error) {
        res.status(500).send({
            status:500,
            error:error.message
        })
    }
}

module.exports = {
    handleGetBillingDevicesFeature,
    handleAddBillingDevicesFeature,
    handleUpdateBillingDevicesFeature
}