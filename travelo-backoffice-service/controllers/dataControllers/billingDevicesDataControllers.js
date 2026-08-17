const { getSequelize } = require("../../config/database")
const { Op } = require("sequelize");
// Samo randomInt iz node:crypto — globalni webcrypto ga nema. NE uvoditi cijeli
// modul kao `crypto`: postojeći pozivi su oblika crypto.randomUUID(16), što
// globalni webcrypto tolerira, a node:crypto baca ERR_INVALID_ARG_TYPE.
const { randomInt } = require("crypto");
const { publishBackofficeEvent } = require("../../message_broker/publisher");
const { modelRequiresSerial } = require("../../helpers/deviceModels");

const sequelize = getSequelize();

// TID = acr tvrtke (3 znaka) + oznaka tipa (01 PC, 02 mobilna) + redni broj (3 znamenke).
// Redni broj se broji unutar prefiksa, pa PC i mobilne blagajne imaju svoje nizove:
// T4B01001, T4B01002, … i T4B02001, T4B02002, …
const TYPE_MARK = { pc: '01', mobile: '02' };

const companyAcrPart = (acr) =>
    String(acr || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .padEnd(3, 'X')
        .slice(0, 3);

// Sljedeći slobodan TID za zadani prefiks — max postojećeg rednog broja + 1.
async function nextTidForPrefix(BillingDevicesModel, prefix) {
    const existing = await BillingDevicesModel.findAll({
        where: { tid: { [Op.like]: `${prefix}%` } },
        attributes: ['tid'],
    });
    let max = 0;
    for (const row of existing) {
        const suffix = String(row.tid || '').slice(prefix.length);
        if (!/^\d{3}$/.test(suffix)) continue;
        const n = parseInt(suffix, 10);
        if (n > max) max = n;
    }
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

// OTP: 6 znakova, mala slova i znamenke. crypto.randomInt daje uniformnu
// raspodjelu (Math.random ovdje nije dovoljno dobar za kod za uparivanje).
const OTP_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const OTP_LENGTH = 6;

const randomOtp = () => {
    let out = '';
    for (let i = 0; i < OTP_LENGTH; i++) {
        out += OTP_CHARS[randomInt(OTP_CHARS.length)];
    }
    return out;
};

// GET /billing_devices/next_otp — generira OTP koji nije u upotrebi ni na jednom
// uređaju. Uz 36^6 kombinacija sudar je malo vjerojatan, ali provjera je jeftina.
const generateBillingDeviceOtpController = async (req, res) => {
    const { BillingDevicesModel } = req.app.locals.models;
    try {
        for (let attempt = 0; attempt < 10; attempt++) {
            const otp = randomOtp();
            const taken = await BillingDevicesModel.findOne({ where: { otp } });
            if (!taken) return res.send({ status: 200, data: { otp } });
        }
        res.status(409).send({
            status: 409,
            msg: 'Nije uspjelo generiranje jedinstvenog OTP-a nakon 10 pokušaja.',
        });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error } });
    }
};

// GET /billing_devices/next_tid?type=pc|mobile
const generateBillingDeviceTidController = async (req, res) => {
    const { BillingDevicesModel, CompanyModel } = req.app.locals.models;
    try {
        const type = req.query.type;
        const mark = TYPE_MARK[type];
        if (!mark) {
            return res.status(400).send({
                status: 400,
                msg: 'TID se generira samo za tip "pc" ili "mobile".',
            });
        }
        const company = await CompanyModel.findOne();
        if (!company?.acr) {
            return res.status(409).send({
                status: 409,
                msg: 'Tvrtka nema postavljen akronim (acr) — TID se ne može generirati.',
            });
        }
        const prefix = `${companyAcrPart(company.acr)}${mark}`;
        const tid = await nextTidForPrefix(BillingDevicesModel, prefix);
        res.send({ status: 200, data: { tid, prefix } });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error } });
    }
};

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
                    device_model:billingDevice.device_model,
                    serial_number:billingDevice.serial_number,
                    auto_pair:billingDevice.auto_pair,
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
    const { BillingDevicesModel, BusinessPremisesModel, DeviceSerialNumbersModel } = req.app.locals.models;
    try {
        const data = req.body.body
        // await je bitan: bez njega iznimka iz transakcije nikad ne dođe do catcha
        // pa zahtjev visi bez odgovora umjesto da vrati 500.
        const result = await sequelize.transaction(async (t)=>{
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
                    // Model i serijski broj postoje samo za mobilnu blagajnu, a SN
                    // samo za modele koji ga vode u zalihi (npr. Sunmi V2s).
                    const deviceModel = isMobile ? (data.device_model || null) : null;
                    const serialNumber = deviceModel && modelRequiresSerial(deviceModel)
                        ? (data.serial_number || null)
                        : null;
                    if (serialNumber) {
                        const sn = await DeviceSerialNumbersModel.findOne({
                            where: { serial_number: serialNumber, is_active: true }
                        });
                        if (!sn) {
                            return res.status(404).send({
                                status: 404,
                                msg: `Serijski broj "${serialNumber}" ne postoji u zalihi.`,
                            });
                        }
                        if (sn.billing_device_uuid) {
                            return res.status(409).send({
                                status: 409,
                                msg: `Serijski broj "${serialNumber}" je već dodijeljen uređaju "${sn.billing_device_name || sn.billing_device_uuid}".`,
                            });
                        }
                    }
                    const newDeviceUuid = crypto.randomUUID(16);
                    const addBillingDevice = await BillingDevicesModel.create({
                        uuid:newDeviceUuid,
                        business_premise_uuid:data.business_premises.uuid,
                        business_premise_name:data.business_premises.name,
                        name:data.name,
                        tid: isWeb ? null : (data.tid || null),
                        otp: isWeb ? null : (data.otp || null),
                        fiscal_mark:data.fiscal_mark,
                        cost_center:data.cost_center,
                        device_model: deviceModel,
                        serial_number: serialNumber,
                        auto_pair: data.auto_pair === true || data.auto_pair === 'true',
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
                    // Zauzmi SN da ga se ne može dodijeliti drugom uređaju.
                    if (serialNumber) {
                        await DeviceSerialNumbersModel.update(
                            { billing_device_uuid: newDeviceUuid, billing_device_name: data.name },
                            { where: { serial_number: serialNumber } }
                        );
                    }
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
    const { BillingDevicesModel, BillingDevicesPermissionsModel, BillingDevicesPaymentMethodsModel, BusinessPremisesModel, DeviceSerialNumbersModel } = req.app.locals.models;
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

                // Model i serijski broj vrijede samo za mobilnu blagajnu, a SN samo
                // za modele koji ga vode u zalihi. Promjena SN-a mora i prebaciti
                // rezervaciju u device_serial_numbers, inače stari ostane zauzet.
                const deviceModel = isMobile
                    ? (data.device_model !== undefined ? (data.device_model || null) : billingDeviceExist.device_model)
                    : null;
                const wantsSerial = deviceModel && modelRequiresSerial(deviceModel);
                const newSerial = wantsSerial
                    ? (data.serial_number !== undefined ? (data.serial_number || null) : billingDeviceExist.serial_number)
                    : null;
                const oldSerial = billingDeviceExist.serial_number || null;

                if (newSerial && newSerial !== oldSerial) {
                    const sn = await DeviceSerialNumbersModel.findOne({
                        where: { serial_number: newSerial, is_active: true }
                    });
                    if (!sn) {
                        return res.status(404).send({
                            status: 404,
                            msg: `Serijski broj "${newSerial}" ne postoji u zalihi.`,
                        });
                    }
                    if (sn.billing_device_uuid && sn.billing_device_uuid !== data.uuid) {
                        return res.status(409).send({
                            status: 409,
                            msg: `Serijski broj "${newSerial}" je već dodijeljen uređaju "${sn.billing_device_name || sn.billing_device_uuid}".`,
                        });
                    }
                }

                const updateBillingDevice = await BillingDevicesModel.update({
                        name:data.name,
                        otp: isWeb ? null : (data.otp ?? billingDeviceExist.otp),
                        tid: isWeb ? null : (data.tid ?? billingDeviceExist.tid),
                        device_model: deviceModel,
                        serial_number: newSerial,
                        ...(data.auto_pair !== undefined
                            ? { auto_pair: data.auto_pair === true || data.auto_pair === 'true' }
                            : {}),
                        // Auto-validacija — honor što stigne s portala, neovisno o tipu.
                        // Prije je bilo isMobile-only što je rušilo save za bus terminale
                        // ako je type_uuid bio UUID (currentType !== 'mobile' → forced false).
                        auto_validate: (data.auto_validate === true || data.auto_validate === 'true'),
                        description:data.description,
                        header:data.header,
                        footer:data.footer,
                        is_active:data.is_active,
                        ...(data.type ? { type_uuid: data.type, type_name: data.type } : {}),
                },{where:{
                    uuid:data.uuid
                }})
                    // Oslobodi stari SN pa zauzmi novi.
                    if (newSerial !== oldSerial) {
                        if (oldSerial) {
                            await DeviceSerialNumbersModel.update(
                                { billing_device_uuid: null, billing_device_name: null },
                                { where: { serial_number: oldSerial } }
                            );
                        }
                        if (newSerial) {
                            await DeviceSerialNumbersModel.update(
                                { billing_device_uuid: data.uuid, billing_device_name: data.name },
                                { where: { serial_number: newSerial } }
                            );
                        }
                    }

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
    updateBillingDeviceController,
    generateBillingDeviceTidController,
    generateBillingDeviceOtpController
}