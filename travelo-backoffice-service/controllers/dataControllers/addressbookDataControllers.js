const { getSequelize } = require("../../config/database");
const addressbookModels = require("../../dbModels/addressbook.models");

const sequelize = getSequelize();

const getAddressbookDataController = async(req,res)=>{
    const {AddressbookModel} = req.app.locals.models;
    try {
        const result = await sequelize.transaction(async(t)=>{
            const addressbookData = await AddressbookModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt']},
                order: [["id", "ASC"]],
            })
            res.send({
                status:200,
                data:{
                    addressbook:addressbookData
                }
            })
        })
    } catch (error) {
        console.log(error)
    }
}

const addAddressbookDataController = async(req,res)=>{
    const {AddressbookModel} = req.app.locals.models;
    try {
        const data = req.body.body
        const result = await sequelize.transaction(async (t)=>{
           
                const addAddressbook = await AddressbookModel.create({
                    uuid:crypto.randomUUID(16),
                    buyer_name:data.buyer_name,
                    buyer_company_name:data.buyer_company_name,
                    buyer_legal_id:data.buyer_legal_id,
                    buyer_vat_id:data.buyer_vat_id,
                    buyer_address:data.buyer_address,
                    buyer_town:data.buyer_town,
                    buyer_postal_code:data.buyer_postal_code,
                    buyer_country:data.buyer_country,
                    buyer_email:data.buyer_email,
                    f2_required:data.f2_required ?? false,
                    buyer_is_active:true
                })
                res.send({
                    status:201,
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

const updateAddressbookDataController = async(req,res)=>{
    try {
        const {AddressbookModel} = req.app.locals.models;
        console.log(req.body)
        const data = req.body.body
        const result = await sequelize.transaction(async (t)=>{
            const addressbookExist = await AddressbookModel.findOne({
                where:{
                    uuid:data.uuid
                }
            })
            if(addressbookExist){
                const updateAddressbook = await AddressbookModel.update({
                    buyer_name:data.buyer_name,
                    buyer_company_name:data.buyer_company_name,
                    buyer_vat_id:data.buyer_vat_id,
                    buyer_address:data.buyer_address,
                    buyer_town:data.buyer_town,
                    buyer_postal_code:data.buyer_postal_code,
                    buyer_country:data.buyer_country,
                    buyer_email:data.buyer_email,
                    f2_required:data.f2_required ?? false,
                    buyer_is_active:data.buyer_is_active
                },{
                    where:{
                        uuid:data.uuid
                    }
                })
                res.send({
                    status:201,
                })
            }else{
                res.send({
                    status:404,
                    data:{
                        msg:'Buyer not exist'
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
    getAddressbookDataController,
    addAddressbookDataController,
    updateAddressbookDataController
}