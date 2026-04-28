const {getPaymentMethodsController, addPaymentMethodsController, updatePaymentMethodsController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/paymentMethodsServiceControllers")

const handleGetPaymentMethodsFeature = async(req,res)=>{
    try {
        const paymentMethodsData = await getPaymentMethodsController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'payment_methods',
                data:paymentMethodsData.data.payment_methods
            }
        })
    } catch (error) {
        
    }
}

const handleAddPaymentMethodsFeature = async(req,res)=>{
    try {
        const addPaymentMethodsData = await addPaymentMethodsController(req.body)
        const paymentMethodsData = await getPaymentMethodsController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'payment_methods',
                data:paymentMethodsData.data.payment_methods
            }
        })
    } catch (error) {
        
    }
}

const handleUpdatePaymentMethodsFeature = async(req,res)=>{
    try {
        console.log('Updating payment methods with data:', req.body);
        const updatePaymentMethodsData = await updatePaymentMethodsController(req.body)
        const paymentMethodsData = await getPaymentMethodsController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'payment_methods',
                data:paymentMethodsData.data.payment_methods
            }
        })
    } catch (error) {
        
    }
}

module.exports = {
    handleGetPaymentMethodsFeature,
    handleAddPaymentMethodsFeature,
    handleUpdatePaymentMethodsFeature
}