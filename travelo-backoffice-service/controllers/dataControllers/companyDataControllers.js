const { getSequelize } = require("../../config/database");


const sequelize = getSequelize();

const getCompanyDataController = async(req,res)=>{
    const { CompanyModel } = req.app.locals.models;
    try {
        const result = sequelize.transaction(async (t) => {
            const companyData = await CompanyModel.findOne({
                attributes: { exclude: ['createdAt','updatedAt'] },
            })
            res.send({
                status:200,
                data:{
                    company:companyData
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

const updateCompanyDataController = async(req,res)=>{
    const { CompanyModel } = req.app.locals.models;
    try {
        const data = req.body
        console.log(data)
        const result = sequelize.transaction(async (t) => {
            const updateCompanyData = await CompanyModel.update({
                name:data.name,
                additional_name:data.additional_name,
                address:data.address,
                postal_code:data.postal_code,
                town:data.town,
                ...(data.legal_id !== undefined ? { legal_id: data.legal_id } : {}),
                ...(data.vat_id !== undefined ? { vat_id: data.vat_id } : {}),
            },{where:{
                id: data.id || data.uuid,
            }})
            res.send({
                status:200,
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

module.exports = {
    getCompanyDataController,
    updateCompanyDataController
}