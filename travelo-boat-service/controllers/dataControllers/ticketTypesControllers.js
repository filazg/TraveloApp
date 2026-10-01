const { getSequelize } = require("../../config/database");
const { javiPromjenu } = require("../../helpers/syncSignal");

// Dodatne karte: samo postojeće vrste, bez same sebe, bez ponavljanja, s
// najvećim brojem po karti 1–20. Ostalo se tiho izbacuje.
const ocistiDodatne = async (TicketsTypesModel, popis, vlastitiUuid) => {
    if (!Array.isArray(popis)) return [];
    const postojeci = new Set((await TicketsTypesModel.findAll({ attributes: ["uuid"], raw: true })).map((t) => t.uuid));
    const vidjeni = new Set();
    const out = [];
    for (const d of popis) {
        const uuid = d?.ticket_type_uuid;
        if (!uuid || uuid === vlastitiUuid || vidjeni.has(uuid) || !postojeci.has(uuid)) continue;
        vidjeni.add(uuid);
        const max = Math.min(20, Math.max(1, Math.round(Number(d.max_qty) || 1)));
        out.push({ ticket_type_uuid: uuid, max_qty: max });
    }
    return out;
};


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
            const novaUuid = crypto.randomUUID(16);
            const ticketTypeDataToAdd = {
                uuid:novaUuid,
                name:data.name,
                name_eng:data.name_eng,
                booking_type_uuid:bt.uuid || null,
                booking_type_acr:bt.acr || null,
                seop_type:data.seop_type,
                is_island: data.is_island === true,
                extra_tickets: await ocistiDodatne(TicketsTypesModel, data.extra_tickets, novaUuid),
                is_active:true,
                updated_by_uuid:user?.uuid || null,
                updated_by_username:user?.username || null
            }
            const newTicketType = await TicketsTypesModel.create(ticketTypeDataToAdd); 
            // Uređaji dodatne karte nose u osnovnim podacima.
            await javiPromjenu("basic", `vrsta karte ${data.name}`).catch(() => {});
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
                ...(Array.isArray(data.extra_tickets)
                    ? { extra_tickets: await ocistiDodatne(TicketsTypesModel, data.extra_tickets, data.uuid) }
                    : {}),
                updated_by_uuid:user.uuid,
                updated_by_username:user.username
            },
            {where:{id:data.id}});
            await javiPromjenu("basic", `vrsta karte ${data.name}`).catch(() => {});
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