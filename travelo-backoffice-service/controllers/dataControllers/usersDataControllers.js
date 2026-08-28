const { getSequelize } = require("../../config/database")
const { publishBackofficeEvent } = require("../../message_broker/publisher");

const sequelize = getSequelize();

const bcrypt = require('bcrypt');

const saltRounds = 10;

const hashedPassword = async(password) =>{
    const pass = await bcrypt.hash(password, saltRounds)
    console.log('PASS JE ', pass)
    return pass
}

// Šifra za prijavu na terminalu — prazna vrijednost se sprema kao null da
// više djelatnika bez šifre ne ispadne "duplikat".
const normalizeCode = (code) => {
    if (code === undefined || code === null) return null;
    const trimmed = String(code).trim();
    return trimmed === '' ? null : trimmed;
};

const findUserByCode = async (UsersModel, code, excludeUuid) => {
    const value = normalizeCode(code);
    if (!value) return null;
    const users = await UsersModel.findAll({ where: { code: value } });
    return users.find((u) => u.uuid !== excludeUuid) || null;
};

const getUsersDataController = async(req,res)=>{
    const {UsersModel, UsersPermissionsModel} = req.app.locals.models;
    try {
        let usersDataToSend = []
        const usersData = await UsersModel.findAll({
            attributes: { exclude: ['createdAt','updatedAt'] },
            order:['id']
        })
        console.log('usersData')
        console.log(usersData)
        console.log('usersData')
        console.log('usersData')
        for(const user of usersData){
            const permissionsForUser = await UsersPermissionsModel.findAll({
                where:{
                    user_uuid:user.uuid,
                    is_active:true
                },
                attributes: { exclude: ['createdAt','updatedAt'] }
            })
            const dataToAdd = {
                id:user.id,
                uuid:user.uuid,
                name:user.name,
                surname:user.surname,
                legal_id:user.legal_id,
                username:user.username,
                password:user.password,
                mark:user.mark,
                is_company_employee:user.is_company_employee,
                partner_uuid:user.partner_uuid,
                partner_name:user.partner_name,
                code:user.code,
                // Bez ovoga se SAOP ID spremi u bazu, ali ga popis ne vrati —
                // forma se otvori prazna pa izgleda kao da nije spremljen.
                saop_clerk_id:user.saop_clerk_id,
                is_active:user.is_active,
                permissions:permissionsForUser
            }
            usersDataToSend = [...usersDataToSend, dataToAdd]
        }
        console.log('tu smo')
        console.log(usersDataToSend)
        res.send({
            status:200,
            data:{
                users:usersDataToSend    
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
const getINTUsersDataController = async(req,res)=>{
    const {UsersModel, UsersPermissionsModel} = req.app.locals.models;
    try {
        let usersDataToSend = []
        const usersData = await UsersModel.findAll({
            attributes: { exclude: ['createdAt','updatedAt'] },
        })
        console.log('usersData')
        console.log(usersData)
        console.log('usersData')
        console.log('usersData')
        for(const user of usersData){
            const permissionsForUser = await UsersPermissionsModel.findAll({
                where:{
                    user_uuid:user.uuid,
                    is_active:true
                },
                attributes: { exclude: ['createdAt','updatedAt'] }
            })
            const dataToAdd = {
                id:user.id,
                uuid:user.uuid,
                name:user.name,
                surname:user.surname,
                legal_id:user.legal_id,
                username:user.username,
                password:user.password,
                mark:user.mark,
                is_company_employee:user.is_company_employee,
                partner_uuid:user.partner_uuid,
                partner_name:user.partner_name,
                code:user.code,
                // Bez ovoga se SAOP ID spremi u bazu, ali ga popis ne vrati —
                // forma se otvori prazna pa izgleda kao da nije spremljen.
                saop_clerk_id:user.saop_clerk_id,
                is_active:user.is_active,
                permissions:permissionsForUser
            }
            usersDataToSend = [...usersDataToSend, dataToAdd]
        }
        console.log('tu smo')
        console.log(usersDataToSend)
        res.send({
            status:200,
            data:{
                users:usersDataToSend    
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

const addUserDataController = async(req,res)=>{
    const {UsersModel} = req.app.locals.models;
    try {
        const data = req.body.body
        console.log(data)
        
        const result = sequelize.transaction(async (t)=>{
            const userExist = await UsersModel.findOne({
                where:{
                    username:data.username
                }
            })
            
                const hash = await hashedPassword(data.password); 
            
            if(!userExist){
                const markExist = await UsersModel.findOne({
                    where:{
                        mark:data.mark,
                    }
                })
                // Šifra je alternativa korisničkom imenu pri prijavi na terminalu,
                // pa dva djelatnika ne smiju dijeliti istu — inače je prijava
                // dvosmislena i račun bi mogao dobiti krivog operatera.
                const codeExist = await findUserByCode(UsersModel, data.code);
                if(codeExist){
                    return res.send({
                        status:208,
                        msg:'Code already exist',
                    })
                }
                if(!markExist){
                    const addUser = await UsersModel.create({
                        uuid:crypto.randomUUID(16),
                        name:data.name,
                        surname:data.surname,
                        legal_id:data.legal_id,
                        username:data.username,
                        password:hash,
                        mark:data.mark,
                        is_company_employee:data.is_company_employee,
                        partner_uuid:data.partner_uuid,
                        partner_name:data.partner_name,
                        code:normalizeCode(data.code),
                        saop_clerk_id:data.saop_clerk_id || null,
                        is_active:true
                    })
                    publishBackofficeEvent('update_users')
                    res.send({
                        status:201,
                    })
                }else{
                    res.send({
                        status:208,
                        msg:'Mark already exist'
                    })
                }
            }else{
                res.send({
                    status:208,
                    msg:'UserAlready exist'
                })
            }
        })
    } catch (error) {
        
    }
}

const updateUserDataController = async(req,res)=>{
    const {UsersModel, UsersPermissionsModel} = req.app.locals.models;
    console.log('UPDATE USER')
   
    try {
        const data = req.body.body
        const result = await sequelize.transaction(async (t)=>{
            const userExist = await UsersModel.findOne({
                where:{
                    uuid:data.uuid,
                }
            })
            let hash = userExist.password
            
            if(data.password !== userExist.password){
                hash = await hashedPassword(data.password)
            }
            
            if(userExist){
                if(data.code !== undefined){
                    const codeExist = await findUserByCode(UsersModel, data.code, data.uuid);
                    if(codeExist){
                        return res.send({
                            status:208,
                            msg:'Code already exist',
                        })
                    }
                }
                const updateUser = await UsersModel.update({
                    name:data.name,
                    surname:data.surname,
                    password:hash,
                    is_active:data.is_active,
                    // Veza na partnera se dosad nije spremala pri izmjeni, pa se
                    // djelatnik nije mogao prebaciti drugom partneru. Vrsta
                    // djelatnika se ne mijenja ovdje, pa se partner pamti samo
                    // kad je poslan.
                    ...(data.partner_uuid !== undefined ? { partner_uuid: data.partner_uuid || null } : {}),
                    ...(data.partner_name !== undefined ? { partner_name: data.partner_name || null } : {}),
                    ...(data.legal_id !== undefined ? { legal_id: data.legal_id } : {}),
                    ...(data.mark !== undefined ? { mark: data.mark } : {}),
                    ...(data.code !== undefined ? { code: normalizeCode(data.code) } : {}),
                    ...(data.saop_clerk_id !== undefined ? { saop_clerk_id: data.saop_clerk_id || null } : {}),
                },{
                    where:{
                        uuid:data.uuid,
                    }
                })
                // Dozvole se diraju samo kad ih pozivatelj posalje. Prije se
                // popis obilazio bezuvjetno, pa je izmjena koja ne salje dozvole
                // (npr. djelatnik partnera s kartice partnera) pucala na
                // "data.permissions is not iterable" — i to unutar transakcije
                // koja se ne ceka, pa se iznimka nije nigdje uhvatila, odgovor
                // nikad nije poslan i portal je ostajao na zaslonu cekanja.
                // Usput bi zatecene dozvole vec bile ugasene.
                const dozvole = Array.isArray(data.permissions) ? data.permissions : null
                if(dozvole){
                    const updateUserPermissions = await UsersPermissionsModel.update({
                        is_active:false
                    },{
                        where:{
                            uuid:data.uuid,
                        }
                    })
                    let premissionsToAdd = []
                    for(const permission of dozvole){
                        const newPermission = {
                            uuid:crypto.randomUUID(16),
                            user_uuid:userExist.uuid,
                            user_name:data.name,
                            user_surname:data.surname,
                            user_username:userExist.username,
                            user_mark:userExist.mark,
                            module_acr:permission.module_acr,
                            module_name:permission.module_name,
                            is_active:true
                        }
                        premissionsToAdd = [...premissionsToAdd, newPermission]
                    }
                    await UsersPermissionsModel.update({
                        is_active:false
                    },{
                        where:{
                            user_uuid:data.uuid
                        }
                    })
                    const addUserPermissions = await UsersPermissionsModel.bulkCreate(premissionsToAdd)
                }
                publishBackofficeEvent('update_users')
                res.send({
                    status:202,
                })
            }else{
                res.send({
                    status:404,
                    msg:'user not exist'
                })
            }
        })
    } catch (error) {
        // Bez ovoga zahtjev visi: greska se dosad nije ni biljezila ni javljala,
        // pa je portal cekao odgovor koji nikad ne stigne.
        console.log('updateUserDataController error:', error?.message || error)
        if (!res.headersSent) {
            res.status(500).send({ status: 500, msg: error?.message || 'update failed' })
        }
    }
}

module.exports = {
    getUsersDataController,
    getINTUsersDataController,
    addUserDataController,
    updateUserDataController
}