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

const getUsersDataController = async(req,res)=>{
    const {UsersModel, UsersPermissionsModel} = req.app.locals.models;
    try {
        let usersDataToSend = []
        const result = await sequelize.transaction(async (t)=>{
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
        const result = await sequelize.transaction(async (t)=>{
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
                        code:data.code,
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
        const result = sequelize.transaction(async (t)=>{
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
                const updateUser = await UsersModel.update({
                    name:data.name,
                    surname:data.surname,
                    password:hash,
                    is_active:data.is_active,
                    ...(data.legal_id !== undefined ? { legal_id: data.legal_id } : {}),
                    ...(data.mark !== undefined ? { mark: data.mark } : {}),
                },{
                    where:{
                        uuid:data.uuid,
                    }
                })
                //if(data.permissions && data.permissions.length > 0){
                    const updateUserPermissions = await UsersPermissionsModel.update({
                        is_active:false
                    },{
                        where:{
                            uuid:data.uuid,
                        }
                    })
                    let premissionsToAdd = []
                    for(const permission of data.permissions){
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
                //}
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
        
    }
}

module.exports = {
    getUsersDataController,
    getINTUsersDataController,
    addUserDataController,
    updateUserDataController
}