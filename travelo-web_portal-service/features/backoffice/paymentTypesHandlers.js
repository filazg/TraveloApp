const { getPaymentTypesController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/paymentTypesServiceControllers")

const handleGetPaymentTypesFeature = async(req,res)=>{
    try {
        const paymentTypesData = await getPaymentTypesController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'payment_types',
                data:paymentTypesData.data.payment_types
            }
        })
    } catch (error) {
        
    }
}

module.exports = {
    handleGetPaymentTypesFeature
}