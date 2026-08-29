const { getSequelize } = require("../../config/database")
const { publishBackofficeEvent } = require("../../message_broker/publisher");

const sequelize = getSequelize();

const getPartnersDataController = async(req,res)=>{
    const {PartnersModel, PartnersWebUsersModel, PartnersAPIUsersModel} = req.app.locals.models;
    try {
        let partnersDataToSend = []
        const partnersData = await PartnersModel.findAll({
            attributes: { exclude: ['createdAt','updatedAt'] },
            order:['id']
        })
        for(const partner of partnersData){
            const partnerWebPermissions = await PartnersWebUsersModel.findAll({
                where:{
                    partner_uuid:partner.uuid,
                    is_active:true
                },
                attributes: { exclude: ['createdAt','updatedAt'] }
            })
            const partnerAPIPermissions = await PartnersAPIUsersModel.findAll({
                where:{
                    partner_uuid:partner.uuid,
                    is_active:true
                },
                attributes: { exclude: ['createdAt','updatedAt'] }
            })
            const dataToSend = {
                id:partner.id,
                uuid:partner.uuid,
                partner_name:partner.partner_name,
                partner_acr:partner.partner_acr,
                partner_legal_id:partner.partner_legal_id,
                partner_vat_id:partner.partner_legal_id,
                partner_address:partner.partner_address,
                partner_postal_code:partner.partner_postal_code,
                partner_town:partner.partner_town,
                partner_country:partner.partner_country,
                partner_email:partner.partner_email,
                partner_contact_person:partner.partner_contact_person,
                commission_pct:partner.commission_pct,
                vat_rate:partner.vat_rate,
                f2_required:partner.f2_required,
                prices_with_vat:partner.prices_with_vat,
                billing_cycle:partner.billing_cycle,
                billing_weekday:partner.billing_weekday,
                is_active:partner.is_active,
                web_permissions:partnerWebPermissions,
                api_permissions:partnerAPIPermissions
            }
            partnersDataToSend = [...partnersDataToSend, dataToSend]
        }
        res.send({
            status:200,
            data:{
                partners:partnersDataToSend
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

const addPartnerDataController = async(req,res)=>{
    const {PartnersModel} = req.app.locals.models;
    
    try {
        const data = req.body.body
        console.log('data')
        console.log(data)
        console.log('data')
        console.log('data')
        const result = await sequelize.transaction(async (t)=>{
            const partnerExist = await PartnersModel.findOne({
                where:{
                    partner_vat_id:data.partner_vat_id
                }
            })
            if(!partnerExist){
                const addPartner = await PartnersModel.create({
                    uuid:crypto.randomUUID(16),
                    partner_name:data.partner_name,
                    partner_acr:data.partner_acr,
                    partner_legal_id:data.partner_vat_id,
                    partner_vat_id:data.partner_vat_id,
                    partner_address:data.partner_address,
                    partner_postal_code:data.partner_postal_code,
                    partner_town:data.partner_town,
                    partner_country:data.partner_country,
                    partner_email:data.partner_email,
                    partner_contact_person:data.partner_contact_person,
                    commission_pct:data.commission_pct ?? 0,
                    vat_rate:data.vat_rate ?? 25,
                    f2_required:data.f2_required ?? false,
                    // Vrijedi samo za partnerovu prodaju za svoj racun.
                    prices_with_vat:data.prices_with_vat ?? true,
                    // Dinamika naplate je podloga za obracun provizije. Dan u
                    // tjednu ima smisla samo uz tjednu dinamiku, pa se inace ne
                    // pamti — da zaostali odabir ne odredjuje razdoblje.
                    billing_cycle:data.billing_cycle || 'MONTHLY',
                    billing_weekday:(data.billing_cycle === 'WEEKLY') ? (Number(data.billing_weekday) || null) : null,
                    is_active:true,
                })
                publishBackofficeEvent('update_partners')
                res.send({
                    status:201,
                })
            }else{
                res.send({
                    status:208,
                    msg:'partner already exist'
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

const updatePartnerDataController = async(req,res)=>{
    const {PartnersModel, PartnersWebUsersModel, PartnersAPIUsersModel} = req.app.locals.models;
    try {
        const data = req.body.body
        const result = sequelize.transaction(async (t)=>{
            const partnerExist = await PartnersModel.findOne({
                where:{
                    uuid:data.uuid
                }
            })
            if(partnerExist){
                const updatePartner = await PartnersModel.update({
                    partner_name:data.partner_name,
                    partner_address:data.partner_address,
                    partner_postal_code:data.partner_postal_code,
                    partner_town:data.partner_town,
                    partner_country:data.partner_country,
                    partner_email:data.partner_email,
                    partner_contact_person:data.partner_contact_person,
                    commission_pct:data.commission_pct ?? 0,
                    vat_rate:data.vat_rate ?? 25,
                    f2_required:data.f2_required ?? false,
                    // Vrijedi samo za partnerovu prodaju za svoj racun.
                    prices_with_vat:data.prices_with_vat ?? true,
                    // Dinamika naplate je podloga za obracun provizije. Dan u
                    // tjednu ima smisla samo uz tjednu dinamiku, pa se inace ne
                    // pamti — da zaostali odabir ne odredjuje razdoblje.
                    billing_cycle:data.billing_cycle || 'MONTHLY',
                    billing_weekday:(data.billing_cycle === 'WEEKLY') ? (Number(data.billing_weekday) || null) : null,
                    is_active:data.is_active,
                },{
                    where:{
                        uuid:data.uuid
                    }
                })
                if(data.web_permissions){
                    await PartnersWebUsersModel.update({
                        is_active:false
                    },{
                        where:{
                            partner_uuid:data.uuid
                        }
                    })
                    let webPermissionToAdd = []
                    for(const perm of data.web_permissions){
                        const newPermision = {
                            uuid:crypto.randomUUID(16),
                            partner_uuid:data.uuid,
                            username:perm.username,
                            password:perm.password,
                            partner_acr:data.partner_acr,
                            is_active:true
                        }
                        webPermissionToAdd = [...webPermissionToAdd,newPermision]
                    }
                    await PartnersWebUsersModel.bulkCreate(webPermissionToAdd)
                }
                if(data.api_permissions){
                    let apiPermissionToAdd = []
                    for(const perm of data.api_permissions){
                        const newPermision = {
                            uuid:crypto.randomUUID(16),
                            partner_uuid:data.uuid,
                            partner_acr:data.partner_acr,
                            tid:perm.tid,
                            otp:perm.otp,
                            key:perm.key,
                            is_active:true
                        }
                        apiPermissionToAdd = [...apiPermissionToAdd,newPermision]
                    }
                    await PartnersAPIUsersModel.update({
                        is_active:false
                    },{
                        where:{
                            partner_uuid:data.uuid
                        }
                    })
                    await PartnersAPIUsersModel.bulkCreate(apiPermissionToAdd)
                }
                publishBackofficeEvent('update_partners')
                res.send({
                    status:200
                })
            }else{
                res.send({
                    status:404,
                    data:{
                        msg:'partner not exist',
                        partners:partnerExist
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

const getPartnersWebUsersDataController = async (req, res) => {
    const { PartnersModel, PartnersWebUsersModel } = req.app.locals.models;
    try {
        const webUsers = await PartnersWebUsersModel.findAll({
            where: { is_active: true },
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            order: ['id'],
        });
        const partnerUuids = [...new Set(webUsers.map(u => u.partner_uuid))];
        const partners = partnerUuids.length
            ? await PartnersModel.findAll({
                  where: { uuid: partnerUuids },
                  attributes: ['uuid', 'partner_name'],
              })
            : [];
        const partnerMap = Object.fromEntries(partners.map(p => [p.uuid, p.partner_name]));
        const enriched = webUsers.map(u => ({
            ...u.toJSON(),
            partner_name: partnerMap[u.partner_uuid] || null,
        }));
        res.send({
            status: 200,
            data: { partners_web_users: enriched },
        });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error } });
    }
};

const getPartnersAPIUsersDataController = async (req, res) => {
    const { PartnersModel, PartnersAPIUsersModel } = req.app.locals.models;
    try {
        const apiUsers = await PartnersAPIUsersModel.findAll({
            where: { is_active: true },
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            order: ['id'],
        });
        const partnerUuids = [...new Set(apiUsers.map(u => u.partner_uuid))];
        const partners = partnerUuids.length
            ? await PartnersModel.findAll({
                  where: { uuid: partnerUuids },
                  attributes: ['uuid', 'partner_name'],
              })
            : [];
        const partnerMap = Object.fromEntries(partners.map(p => [p.uuid, p.partner_name]));
        const enriched = apiUsers.map(u => ({
            ...u.toJSON(),
            partner_name: partnerMap[u.partner_uuid] || null,
        }));
        res.send({
            status: 200,
            data: { partners_api_users: enriched },
        });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error } });
    }
};

module.exports = {
    getPartnersDataController,
    addPartnerDataController,
    updatePartnerDataController,
    getPartnersWebUsersDataController,
    getPartnersAPIUsersDataController,
}