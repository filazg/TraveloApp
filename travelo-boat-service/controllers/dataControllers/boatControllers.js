const { getSequelize } = require("../../config/database");


const getBoatsDataController = async (req, res) =>{
    const { BoatsModel } = req.app.locals.models;    
    const sequelize = getSequelize();
    try {
        const result = await sequelize.transaction(async (t)=>{
            const boatsData = await BoatsModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            });
            res.send({
                status:200,
                data:{
                    boats:boatsData
                }
            })
        });
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

const addBoatDataController = async (req, res) =>{
    const sequelize = getSequelize();
    const { BoatsModel } = req.app.locals.models;    
    const user = req.body.header
    const data = req.body.body;
    let responseData = {
        status:200,
        msg:'Boat added successfully'
    }
    try {
        const result = await sequelize.transaction(async (t)=>{
            const boatExist = await BoatsModel.findOne({where:{nib:data.nib}});
            if(boatExist){
                responseData = {
                    status:400,
                    msg:'Boat with that nib already exist'
                }
            }else{
                const boatDataToAdd = {
                    uuid:crypto.randomUUID(16),
                    name: data.name,
                    nib: data.nib,
                    imo: data.imo,
                    capacity: Number(data.capacity) || 0,
                    vip_capacity: Number(data.vip_capacity) || 0,
                    pets_capacity: Number(data.pets_capacity) || 0,
                    bicycle_capacity: Number(data.bicycle_capacity) || 0,
                    updated_by_uuid:user.updated_by_uuid,
                    updated_by_username:user.updated_by_username
                }
                const newBoat = await BoatsModel.create(boatDataToAdd); 
                responseData = {
                    status:200,
                    msg:'Boat added successfully'
                }
            }
             const boatsData = await BoatsModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            });
            res.send({
                status:responseData.status,
                msg:responseData.msg,
                data:{
                    boats:boatsData
                }
            })
        })
    }catch (error) {
        console.log(error)
        res.send({
            status:500,
            data:{
                error
            }
        })
    }
} 

const updateBoatDataController = async (req, res) =>{
    const sequelize = getSequelize();
    const { BoatsModel } = req.app.locals.models;    
    const user = req.body.header
    const data = req.body.body;
    let responseData = {
        status:200,
        msg:'Boat updated successfully'
    }
    try {
        const result = await sequelize.transaction(async (t)=>{
            const boatExist = await BoatsModel.findOne({where:{nib:data.nib}});
            if(boatExist){
                await BoatsModel.update({
                    name: data.name,
                    capacity: data.capacity,
                    vip_capacity: data.vip_capacity,
                    pets_capacity: data.pets_capacity,
                    bicycle_capacity: data.bicycle_capacity,
                    updated_by_uuid:user.updated_by_uuid,
                    updated_by_username:user.updated_by_username
                    },
                    {where:{nib:data.nib}});
                responseData = {
                    status:200,
                    msg:'Boat updated successfully'
                }
            }else{
                responseData = {
                    status:400,
                    msg:'Boat with that nib does not exist'
                }
            }
             const boatsData = await BoatsModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            });
            res.send({
                status:responseData.status,
                msg:responseData.msg,
                data:{
                    boats:boatsData
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

module.exports = {
    getBoatsDataController,
    addBoatDataController,
    updateBoatDataController
}