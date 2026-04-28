const { getSequelize } = require("../../config/database")

const sequelize = getSequelize();

const getPaymentTypesDataController = async(req,res)=>{
    const {PaymentTypesModel} = req.app.locals.models;
    
    try {
        const paymentTypesData = await PaymentTypesModel.findAll()
        res.send({
            status:200,
            data:{
                payment_types:paymentTypesData
            }
        })
    } catch (error) {
        console.log(error)
        res.send({
            status: 500,
            data: error
        })
    }
}

module.exports = {
    getPaymentTypesDataController
}