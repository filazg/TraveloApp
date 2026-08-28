const { getSequelize } = require("../../config/database");


const sequelize = getSequelize();

const getCompanyDataController = async(req,res)=>{
    const { CompanyModel } = req.app.locals.models;
    try {
        const companyData = await CompanyModel.findOne({
            attributes: { exclude: ['createdAt','updatedAt'] },
        })
        res.send({
            status:200,
            data:{
                company:companyData
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

const updateCompanyDataController = async(req,res)=>{
    const { CompanyModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body
        console.log(data)
        const result = sequelize.transaction(async (t) => {
            const updateCompanyData = await CompanyModel.update({
                name:data.name,
                additional_name:data.additional_name,
                address:data.address,
                postal_code:data.postal_code,
                town:data.town,
                ...(data.contact_tel !== undefined ? { contact_tel: data.contact_tel } : {}),
                ...(data.contact_email !== undefined ? { contact_email: data.contact_email } : {}),
                ...(data.contact_person !== undefined ? { contact_person: data.contact_person } : {}),
                ...(data.legal_id !== undefined ? { legal_id: data.legal_id } : {}),
                ...(data.vat_id !== undefined ? { vat_id: data.vat_id } : {}),
                ...(data.iban !== undefined ? { iban: data.iban } : {}),
                ...(data.swift !== undefined ? { swift: data.swift } : {}),
                ...(data.bank_name !== undefined ? { bank_name: data.bank_name } : {}),
                ...(data.saop_organization_id !== undefined ? { saop_organization_id: data.saop_organization_id } : {}),
                ...(data.saop_link_to_book !== undefined ? { saop_link_to_book: data.saop_link_to_book } : {}),
                ...(data.saop_default_customer !== undefined ? { saop_default_customer: data.saop_default_customer } : {}),
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