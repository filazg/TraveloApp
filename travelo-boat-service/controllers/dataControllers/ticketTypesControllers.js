const { getSequelize } = require("../../config/database");


const getTicketsTypesDataController = async (req, res) => {
    const sequelize = getSequelize();
    const { TicketsTypesModel } = req.app.locals.models;
    try {
        const ticketTypesData = await TicketsTypesModel.findAll({
            attributes: { exclude: ['createdAt','updatedAt'] },
            order: [["id", "ASC"]],
        })
        res.send({
            status:200,
            data:{
                ticketTypes:ticketTypesData
            }
        })
    } catch (error) {
        res.send({
            status:500,
            data:{
                error
            }
        })
    }
}


const addTicketTypeDataController = async (req, res) =>{
    const sequelize = getSequelize();
    const { TicketsTypesModel } = req.app.locals.models;    
    const user = req.body.header
    const data = req.body.body;
    console.log(data)
    let responseData = {
        status:200,
        msg:'Ticket type added successfully'
    }
    try {
        const ticketTypeExist = await TicketsTypesModel.findOne({where:{name:data.name}});
        if(ticketTypeExist){
            responseData = {
                status:400,
                msg:'Ticket type with that name already exist'
            }
        }else{
            const bt = data.booking_type || {};
            const ticketTypeDataToAdd = {
                uuid:crypto.randomUUID(16),
                name:data.name,
                name_eng:data.name_eng,
                booking_type_uuid:bt.uuid || null,
                booking_type_acr:bt.acr || null,
                seop_type:data.seop_type,
                is_island: data.is_island === true,
                is_active:true,
                updated_by_uuid:user?.uuid || null,
                updated_by_username:user?.username || null
            }
            const newTicketType = await TicketsTypesModel.create(ticketTypeDataToAdd); 
            responseData = {
                status:200,
                msg:'Ticket type added successfully'
            }
        }
        const ticketTypesData = await TicketsTypesModel.findAll({
            attributes: { exclude: ['createdAt','updatedAt'] },
            order: [["id", "ASC"]],
        })
        res.send({
            status:responseData.status,
            msg:responseData.msg,
            data:{
                ticketTypes:ticketTypesData
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

const updateTicketTypeDataController = async (req, res) =>{
    const sequelize = getSequelize();
    const { TicketsTypesModel } = req.app.locals.models;    
    const user = req.body.header
    const data = req.body.body;
    let responseData = {
        status:200,
        msg:'Ticket type updated successfully'
    }
    try {
        const ticketTypeExist = await TicketsTypesModel.findOne({where:{uuid:data.uuid}});
        if(ticketTypeExist){
            await TicketsTypesModel.update({
                name: data.name,
                name_eng: data.name_eng,
                booking_type_uuid: data.booking_type_uuid,
                booking_type: data.booking_type,
                seop_type: data.seop_type,
                // is_island se postavlja SAMO pri dodavanju, ne mijenja se editom
                is_active: data.is_active,
                updated_by_uuid:user.uuid,
                updated_by_username:user.username
            },
            {where:{id:data.id}});
            responseData = {
                status:200,
                msg:'Ticket type updated successfully'
            }
        }else{
            responseData = {
                status:400,
                msg:'Ticket type with that name already exist'
            }
        }
        const ticketTypesData = await TicketsTypesModel.findAll({
            attributes: { exclude: ['createdAt','updatedAt'] },
            order: [["id", "ASC"]],
        })
        res.send({
            status:responseData.status,
            msg:responseData.msg,
            data:{
                ticketTypes:ticketTypesData
            }
        })
    } catch (error) {
        res.send({
            status:500,
            data:{
                error
            }
        })
    }
}

module.exports = {
    getTicketsTypesDataController,
    addTicketTypeDataController,
    updateTicketTypeDataController
}