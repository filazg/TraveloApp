const { getBillingDevicesController, addBillingDevicesController, updateBillingDevicesController, getNextTidController, getNextOtpController, getDeviceModelsController, getDeviceSerialNumbersController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/billingDevicesServiceControllers")
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

// Vraća prijedlog TID-a; ne sprema ništa dok korisnik ne spremi uređaj.
const handleGetNextTidFeature = async(req,res)=>{
    try {
        const result = await getNextTidController(req.query.type)
        res.send({ status:200, data:{ tid: result?.data?.tid || null } })
    } catch (error) {
        const status = error.response?.status || 500
        res.status(status).send({ status, error: error.response?.data?.msg || error.message })
    }
}

const handleGetNextOtpFeature = async(req,res)=>{
    try {
        const result = await getNextOtpController()
        res.send({ status:200, data:{ otp: result?.data?.otp || null } })
    } catch (error) {
        const status = error.response?.status || 500
        res.status(status).send({ status, error: error.response?.data?.msg || error.message })
    }
}

const handleGetDeviceModelsFeature = async(req,res)=>{
    try {
        const result = await getDeviceModelsController()
        res.send({ status:200, data:{ device_models: result?.data?.device_models || [] } })
    } catch (error) {
        res.status(500).send({ status:500, error:error.message })
    }
}

const handleGetDeviceSerialNumbersFeature = async(req,res)=>{
    try {
        const result = await getDeviceSerialNumbersController(req.query)
        res.send({ status:200, data:{ device_serial_numbers: result?.data?.device_serial_numbers || [] } })
    } catch (error) {
        res.status(500).send({ status:500, error:error.message })
    }
}

module.exports = {
    handleGetBillingDevicesFeature,
    handleAddBillingDevicesFeature,
    handleUpdateBillingDevicesFeature,
    handleGetNextTidFeature,
    handleGetNextOtpFeature,
    handleGetDeviceModelsFeature,
    handleGetDeviceSerialNumbersFeature
}