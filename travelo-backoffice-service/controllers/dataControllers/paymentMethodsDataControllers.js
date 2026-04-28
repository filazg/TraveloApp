const { getSequelize } = require("../../config/database")

const sequelize = getSequelize();

const getPaymentMethodsDataController = async(req,res)=>{
    const {PaymentMethodsModel} = req.app.locals.models;
    try {
         const result = await sequelize.transaction(async (t)=>{
            const paymentMethodsData = await PaymentMethodsModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
            })
            res.send({
                status:200,
                data:{
                    payment_methods:paymentMethodsData
                }
            })
         }) 
    } catch (error) {
        console.log(error)
        res.send({
            status:500,
            data:{
                error
            }
        })
    }
}

const addPaymentMethodDataController = async(req,res)=>{
    const {PaymentMethodsModel} = req.app.locals.models;
    try {
        const data = req.body.body
        const result = await sequelize.transaction(async (t)=>{
            const paymentMethodExist = await PaymentMethodsModel.findOne({
                where:{
                    name:data.name
                }
            })
            if(!paymentMethodExist){
                const addPaymentMethod = await PaymentMethodsModel.create({
                    uuid:crypto.randomUUID(16),
                    name:data.name,
                    is_card_payment:data.is_card_payment,
                    payment_type_uuid:data.type.uuid,
                    payment_type_acr:data.type.acr,
                    fiscalization:data.fiscalization
                })
                res.send({
                    status:201,
                })
            }else{
                res.send({
                    status:208,
                    data:{
                        msg:'Payment method already exist',
                        payment_method:paymentMethodExist
                    }
                })
            }
        })
    } catch (error) {
        console.log(error)
        res.send({
            status:500,
            data:{
                error
            }
        })
    }
}

const updatePaymentMethodDataController = async(req,res)=>{
    const {PaymentMethodsModel} = req.app.locals.models;
    try {
        const data = req.body.body
        console.log(data)
        const result = await sequelize.transaction(async (t)=>{
            const paymentMethodExist = await PaymentMethodsModel.findOne({
                where:{
                    uuid:data.uuid
                }
            })
            if(paymentMethodExist){
                const updatePAymentMethod = await PaymentMethodsModel.update({
                    name:data.name,
                },{
                    where:{
                        uuid:data.uuid
                    }
                })
                res.send({
                    status:202,
                })
            }else{
                res.send({
                    status:404,
                    data:{
                        msg:'Payment method not exist',
                    }
                })
            }
        })
    } catch (error) {
        console.log(error)
        res.send({
            status:500,
            data:{
                error
            }
        })
    }
}

module.exports = {
    getPaymentMethodsDataController,
    addPaymentMethodDataController,
    updatePaymentMethodDataController
}