const { getSequelize } = require("../../config/database")
const { Op } = require("sequelize");
const { publishBackofficeEvent } = require("../../message_broker/publisher");

const sequelize = getSequelize();

// Singleton pravilo — pod prodajnim mjestom tipa Web prodaja (WEB_OFFICE) smije biti
// samo jedan aktivan naplatni uređaj. Vraća postojećeg ako postoji, inače null.
async function findConflictingActiveWebDevice(
    BillingDevicesModel,
    BusinessPremisesModel,
    { business_premise_uuid, is_active, excludeUuid }
) {
    if (!business_premise_uuid || !is_active) return null;
    const bp = await BusinessPremisesModel.findOne({ where: { uuid: business_premise_uuid } });
    if (!bp || bp.type !== 'WEB_OFFICE') return null;
    const where = { business_premise_uuid, is_active: true };
    if (excludeUuid) where.uuid = { [Op.ne]: excludeUuid };
    return BillingDevicesModel.findOne({ where });
}

const getBillingDevicesController = async(req,res)=>{
    const { BillingDevicesModel, BillingDevicesPermissionsModel, BillingDevicesPaymentMethodsModel } = req.app.locals.models;
    try {
        let billingDeviceDataToSend = []
        const result = await sequelize.transaction(async (t)=>{
            const billingDevicesData = await BillingDevicesModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            })
            for(const billingDevice of billingDevicesData){
                const permissionsForBillingDevice = await BillingDevicesPermissionsModel.findAll({
                    where:{
                        billing_device_uuid:billingDevice.uuid,
                        is_active:true
                    },
                    attributes: { exclude: ['createdAt','updatedAt'] }
                })
                const paymentMethodsForBillingDevice = await BillingDevicesPaymentMethodsModel.findAll({
                    where:{
                        billing_device_uuid:billingDevice.uuid,
                        is_active:true
                    },
                    attributes: { exclude: ['createdAt','updatedAt'] }
                })
                const dataTaAdd = {
                    id:billingDevice.id,
                    uuid:billingDevice.uuid,
                    business_premise_uuid:billingDevice.business_premise_uuid,
                    business_premise_name:billingDevice.business_premise_name,
                    name:billingDevice.name,
                    tid:billingDevice.tid,
                    otp:billingDevice.otp,
                    fiscal_mark:billingDevice.fiscal_mark,
                    cost_center:billingDevice.cost_center,
                    serial_number:billingDevice.serial_number,
                    auto_validate:billingDevice.auto_validate,
                    description:billingDevice.description,
                    type_uuid:billingDevice.type_uuid,
                    type_name:billingDevice.type_name,
                    header:billingDevice.header,
                    footer:billingDevice.footer,
                    is_active:billingDevice.is_active,
                    permissions:permissionsForBillingDevice,
                    payment:paymentMethodsForBillingDevice
                }
                billingDeviceDataToSend = [...billingDeviceDataToSend, dataTaAdd]
            }
        })
        res.send({
            status:200,
            data:{
                billing_devices:billingDeviceDataToSend
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

const addBillingDeviceController = async(req,res)=>{
    const { BillingDevicesModel, BusinessPremisesModel } = req.app.locals.models;
    try {
        const data = req.body.body
        const result = sequelize.transaction(async (t)=>{
            // Singleton za WEB: max 1 aktivan uređaj po WEB prodajnom mjestu.
            const webConflict = await findConflictingActiveWebDevice(
                BillingDevicesModel,
                BusinessPremisesModel,
                {
                    business_premise_uuid: data.business_premises?.uuid,
                    is_active: data.is_active,
                }
            );
            if (webConflict) {
                return res.status(409).send({
                    status: 409,
                    msg: `Pod prodajnim mjestom tipa Web prodaja već postoji aktivan naplatni uređaj "${webConflict.name}". Deaktivirajte ga prije dodavanja novog.`,
                    conflict_uuid: webConflict.uuid,
                });
            }
            const billingDeviceExist = await BillingDevicesModel.findOne({
                where:{
                    business_premise_uuid:data.business_premises.uuid,
                    fiscal_mark:data.fiscal_mark
                }
            })
            if(!billingDeviceExist){
                // TID je obavezan samo za pc/mobile — web uređaj ga nema pa preskoči check.
                const tidExist = data.tid
                    ? await BillingDevicesModel.findOne({
                        where: { tid: data.tid },
                        attributes: { exclude: ['createdAt','updatedAt'] }
                    })
                    : null;
                if(!tidExist){
                    // Normaliziraj polja po tipu uređaja.
                    const isWeb = data.type === 'web';
                    const isMobile = data.type === 'mobile';
                    const addBillingDevice = await BillingDevicesModel.create({
                        uuid:crypto.randomUUID(16),
                        business_premise_uuid:data.business_premises.uuid,
                        business_premise_name:data.business_premises.name,
                        name:data.name,
                        tid: isWeb ? null : (data.tid || null),
                        otp: isWeb ? null : (data.otp || null),
                        fiscal_mark:data.fiscal_mark,
                        cost_center:data.cost_center,
                        auto_validate: isMobile
                            ? (data.auto_validate === true || data.auto_validate === 'true')
                            : false,
                        description:data.description,
                        type_uuid:data.type,
                        type_name:data.type,
                        header:data.header,
                        footer:data.footer,
                        is_active:data.is_active
                    })
                    publishBackofficeEvent('update_terminals')
                    res.send({
                        status:201,
                    })
                }else{
                    res.send({
                        status:208,
                        data:{
                            msg:'TID already exist',
                            billing_device:tidExist
                        }
                    })
                }
            }else{
                res.send({
                    status:208,
                    data:{
                        msg:'Billing device already exist',
                        billing_device:billingDeviceExist
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

const updateBillingDeviceController = async(req,res)=>{
    const { BillingDevicesModel, BillingDevicesPermissionsModel, BillingDevicesPaymentMethodsModel, BusinessPremisesModel } = req.app.locals.models;
    try {
        const data = req.body.body
         console.log('UPDATE  DATA')
        console.log(data)
        console.log('UPDATE  DATA')
        const result = sequelize.transaction(async (t)=>{
            const billingDeviceExist = await BillingDevicesModel.findOne({
                where:{
                    uuid:data.uuid
                }
            })
            // Singleton za WEB: ako se uređaj aktivira, provjeri da nije već 2 pod istim WEB premiseom.
            const targetActive = data.is_active ?? billingDeviceExist?.is_active;
            const bpUuid = data.business_premises?.uuid || billingDeviceExist?.business_premise_uuid;
            const webConflict = await findConflictingActiveWebDevice(
                BillingDevicesModel,
                BusinessPremisesModel,
                { business_premise_uuid: bpUuid, is_active: targetActive, excludeUuid: data.uuid }
            );
            if (webConflict) {
                return res.status(409).send({
                    status: 409,
                    msg: `Pod prodajnim mjestom tipa Web prodaja već postoji aktivan naplatni uređaj "${webConflict.name}". Deaktivirajte ga prije aktiviranja drugog.`,
                    conflict_uuid: webConflict.uuid,
                });
            }
            console.log(data.uuid)
            console.log(billingDeviceExist)
            if(billingDeviceExist){
                console.log('IMA TERMINALA')
                const currentType = billingDeviceExist.type_uuid || billingDeviceExist.type_name;
                const newType = data.type || currentType;
                const isWeb = newType === 'web';
                const isMobile = newType === 'mobile';
                const updateBillingDevice = await BillingDevicesModel.update({
                        name:data.name,
                        otp: isWeb ? null : (data.otp ?? billingDeviceExist.otp),
                        tid: isWeb ? null : (data.tid ?? billingDeviceExist.tid),
                        serial_number:data.serial_number,
                        auto_validate: isMobile
                            ? (data.auto_validate === true || data.auto_validate === 'true')
                            : false,
                        description:data.description,
                        header:data.header,
                        footer:data.footer,
                        is_active:data.is_active,
                        ...(data.type ? { type_uuid: data.type, type_name: data.type } : {}),
                },{where:{
                    uuid:data.uuid
                }})
                    const updateBillingDevicePermissions = await BillingDevicesPermissionsModel.update({
                        is_active:false
                    },{where:{
                        billing_device_uuid:data.uuid
                    }})
                    if(data.permissions){
                        let dataForCreate = []
                        for(const permission of data.permissions){
                            const newPermission = {
                                uuid:permission.uuid,
                                billing_device_uuid:data.uuid,
                                name:permission.name,
                                surname:permission.surname,
                                username:permission.username,
                                mark:permission.mark,
                                is_active:true
                            }
                            dataForCreate = [...dataForCreate, newPermission]
                        }
                        const addBillingDevicePermissions = await BillingDevicesPermissionsModel.bulkCreate(dataForCreate)
                    }
                    console.log('TU SMO FDSFAS')
                    const updateBillingDevicePaymentMethods = await BillingDevicesPaymentMethodsModel.update({
                        is_active:false
                    },{where:{
                        billing_device_uuid:data.uuid
                    }})
                    if(data.payment){
                        let dataForCreate = []
                        for(const payment of data.payment){
                            const newPayment = {
                                billing_device_uuid:data.uuid,
                                uuid:payment.uuid,
                                name:payment.name,
                                is_card_payment:payment.is_card_payment,
                                payment_type_uuid:payment.payment_type_uuid,
                                payment_type_acr:payment.payment_type_acr,
                                fiscalization:payment.fiscalization,
                                is_active:true
                            }
                            dataForCreate = [...dataForCreate,newPayment]
                        }
                        const addBillingDevicePaymentMethods = await BillingDevicesPaymentMethodsModel.bulkCreate(dataForCreate)
                    }
                    
                    console.log('TU SMO KRAJ')
                publishBackofficeEvent('update_terminals')
                res.send({
                    status:202,
                })
            }else{
                res.send({
                    status:404,
                    data:{
                        msg:'Billing device not exist',
                        billing_device:billingDeviceExist
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
    getBillingDevicesController,
    addBillingDeviceController,
    updateBillingDeviceController
}