const { getSequelize } = require("../../config/database")

const sequelize = getSequelize();

// Portal salje boolean iz <select>-a kao string, a "false" je u JS-u truthy —
// bez normalizacije bi negativan odabir prosao kao karticni.
const asBool = (v) => v === true || v === 'true'


const getPaymentMethodsDataController = async(req,res)=>{
    const {PaymentMethodsModel} = req.app.locals.models;
    try {
            const paymentMethodsData = await PaymentMethodsModel.findAll({
            attributes: { exclude: ['createdAt','updatedAt'] },
            })
            res.send({
            status:200,
            data:{
                payment_methods:paymentMethodsData
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
                    is_card_payment:asBool(data.is_card_payment),
                    card_provider:asBool(data.is_card_payment) ? (data.card_provider || null) : null,
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
                // Uz naziv se sada spremaju i kartične postavke — bez toga se
                // provider ne bi mogao promijeniti na postojećem sredstvu.
                // Tip i fiskalizacija se i dalje ne mijenjaju kroz uređivanje.
                const updatePAymentMethod = await PaymentMethodsModel.update({
                    name:data.name,
                    is_card_payment:asBool(data.is_card_payment),
                    card_provider:asBool(data.is_card_payment) ? (data.card_provider || null) : null,
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