const axios = require("axios");
const { getSequelize } = require("../../config/database");
const { getCoreServiceConfigData } = require("../configSyncController");

// Fire-and-forget: pokrene init bookings za svaki novonastali polazak.
// Greške se samo loga; padom booking-servisa se ne rollbacka kreiranje timetable-a.
const initBookingsForDepartures = async (departureUuids) => {
    try {
        if (!Array.isArray(departureUuids) || departureUuids.length === 0) return;
        const coreConfig = await getCoreServiceConfigData();
        const bookingUrl = coreConfig?.services?.booking?.url;
        if (!bookingUrl) {
            console.log("initBookingsForDepartures: booking service URL nije konfiguriran — preskačem.");
            return;
        }
        const unique = [...new Set(departureUuids.filter(Boolean))];
        await Promise.all(unique.map(async (departure_uuid) => {
            try {
                const resp = await axios.post(`${bookingUrl}/bookings/init`, { departure_uuid }, {
                    timeout: 8000,
                    validateStatus: () => true,
                });
                if (resp.status !== 200) {
                    console.log(`initBookings ${departure_uuid} HTTP ${resp.status}:`, resp.data?.data?.message || resp.data);
                }
            } catch (err) {
                console.log(`initBookings ${departure_uuid} error:`, err?.message || err);
            }
        }));
    } catch (err) {
        console.log("initBookingsForDepartures error:", err?.message || err);
    }
};


const dateFormater = (data) => {
      const originDay = data.split(".")[0];
      const originMonth = data.split(".")[1];
      let dayToReturn = "";
      let monthToReturn = "";
      if (originDay.length === 1) {
        dayToReturn = "0" + originDay;
      } else {
        dayToReturn = originDay;
      }
      if (originMonth.length === 1) {
        monthToReturn = "0" + originMonth;
      } else {
        monthToReturn = originMonth;
      }
      return (
        dayToReturn +
        "." +
        monthToReturn +
        "." +
        data.split(".")[2] +
        "." +
        data.split(".")[3]
      );
    };


const getTimetableDataController = async(req, res)=>{
    try {
        const sequelize = getSequelize();
        const { TimetablesModel} = req.app.locals.models;
        let responseData = {
            status:200,
            msg:'Timetable added successfully'
        }
        const result = await sequelize.transaction(async (t)=>{
            const timetableData = await TimetablesModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            });
            res.send({
                status:responseData.status,
                msg:responseData.msg,
                data:{
                    timetables:timetableData
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

const getTimetableDetailsController = async (req,res)=>{
    try {
        console.log("EDIT called", req.body);
        //const user = req.body.user;
        const data = req.body.data;
        const sequelize = getSequelize();
        let responseData = {
            status:200,
            msg:'Timetable details get successfully'
        }
        const { TimetablesModel, DeparturesModel, TimetablePricesModel, TicketsTypesModel} = req.app.locals.models;
        const result = await sequelize.transaction(async (t)=>{
            const timetableData = await TimetablesModel.findOne({
                where:{
                    uuid:data.uuid
                },
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            });
            let departuresToSend = []
            let pricesToSend = []
            if(timetableData){
                const ticketTypesData = await TicketsTypesModel.findAll({
                    attributes: { exclude: ['createdAt','updatedAt'] },
                    order: [["id", "ASC"]],
                })
                const departuresForTimetable = await DeparturesModel.findAll({
                    where:{
                        timetable_uuid:timetableData.uuid,
                        is_actual:true
                    },
                    attributes: { exclude: ['createdAt','updatedAt'] },
                    order: [["id", "ASC"]],
                })
                departuresToSend = departuresForTimetable
                const pricesForTimetable = await TimetablePricesModel.findAll({
                    where:{
                        timetable_uuid:timetableData.uuid,
                        is_active:true
                    },
                    attributes: { exclude: ['createdAt','updatedAt'] },
                    order: [["id", "ASC"]],
                })
                const uniqueTicketType = pricesForTimetable.filter(
                    (v, i, a) =>
                    a.findIndex((t) => t.ticket_type_uuid === v.ticket_type_uuid) ===
                    i,
                );
                for(const ticketType of uniqueTicketType){
                    const ticketTypeForTimetable = ticketTypesData.find((tt)=> tt.uuid === ticketType.ticket_type_uuid)
                    const pricesForTicketType = pricesForTimetable.filter((pftt)=>pftt.ticket_type_uuid === ticketType.ticket_type_uuid)
                    const newPrice = {
                        ticket_type: ticketTypeForTimetable,
                        prices:pricesForTicketType
                    } 

                    pricesToSend = [...pricesToSend, newPrice]
                }



            }
            res.send({
                status:responseData.status,
                msg:responseData.msg,
                data:{
                    timetable_details:{
                        departures: departuresToSend,
                        prices: pricesToSend
                    }
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

const addTimetableDataController = async (req, res) => {
    console.log("addTimetableDataController called",req.body);
    const user = req.body.user;
    const data = req.body.data;
    const sequelize = getSequelize();
    const { TimetablesModel, BoatsModel, HarborsModel, DeparturesModel, TimetablePricesModel, RoutesModel } = req.app.locals.models;
    let responseData = {
        status:200,
        msg:'Timetable added successfully'
    }
    try {
        const result = await sequelize.transaction(async (t)=>{
            const needsFullProcessing = !!(data.departuresForTimetable || data.timetablePrices);
            const timetableExists = await TimetablesModel.findOne({ where: { code: data.timetableData.code } });
            const boatsData = needsFullProcessing ? await BoatsModel.findAll() : [];
            let harbors = needsFullProcessing ? await HarborsModel.findAll() : [];
            const tiumetableUUID = crypto.randomUUID(16);
            let timetableData = {}
            let departuresToAdd = [];
            if (!timetableExists) {
                //CREATTING TIMETABLE
                const addTimetable = await TimetablesModel.create({
                    uuid: tiumetableUUID,
                    code: data.timetableData.code,
                    name: data.timetableData.name,
                    line_uuid: data.timetableData.line_uuid,
                    line_code: data.timetableData.line_code,
                    line_name: data.timetableData.line_name,
                    is_active: false,
                    updated_by_uuid:user.uuid,
                    updated_by_username:user.username
                }); 
                timetableData = addTimetable;  
            }else{
                console.log('POSTOJI TIMETABLE')
                const updateTimetable = await TimetablesModel.update(
                    {
                        is_active: data.timetableData.is_active,
                        updated_by_uuid:user.uuid,
                        updated_by_username:user.username
                    },{
                        where:{
                            code:data.timetableData.code
                        }
                    })
                timetableData = await TimetablesModel.findOne({ where: { code: data.timetableData.code } });
                console.log('timetable DATA ', timetableData)
            }
            //DEPARTURES
            if(data.departuresForTimetable){            
            for(const departure of data.departuresForTimetable){
                const boat = boatsData.find(
                    (boat) => boat.uuid === departure.boat_uuid
                );
                const depHarbor = harbors.find(
                    (harbor) => harbor.code === departure.departure_harbor_id
                );
                const arrHarbor = harbors.find(
                    (harbor) => harbor.code === departure.arrival_harbor_id
                );
                const newDeparture = {
                    uuid: crypto.randomUUID(16),
                    timetable_uuid: timetableData.uuid,
                    line_uuid: timetableData.line_uuid,
                    line_code: timetableData.line_code,
                    line_name: timetableData.line_name,
                    sequence: departure.sequence,
                    voyage_id: departure.voyage_id,
                    departure_harbor_id: depHarbor.code,
                    departure_harbor_name: depHarbor.name,
                    arrival_harbor_id: arrHarbor.code,
                    arrival_harbor_name: arrHarbor.name,
                    departure_planed: dateFormater(departure.departure_planed),
                    departure: dateFormater(departure.departure),
                    arrival_planed: dateFormater(departure.arrival_planed),
                    arrival: dateFormater(departure.arrival),
                    harbor_order: departure.harbor_order,
                    direction: departure.direction,
                    boat_uuid: boat.uuid,
                    base_capacity: boat.capacity,
                    base_vip_capacity: boat.vip_capacity,
                    base_pets_capacity: boat.pets_capacity,
                    base_bicycle_capacity: boat.bicycle_capacity,
                    ret_koef: 100,
                    updated_by_uuid:user.uuid,
                    updated_by_username:user.username,
                    is_active: true,
                    is_actual: true,
                };
                departuresToAdd = [...departuresToAdd, newDeparture];

            }
            await DeparturesModel.update(
                {
                    is_active: false,
                    is_actual: false,
                    updated_by_uuid:user.uuid,
                    updated_by_username:user.username,
                },
                {
                    where: {
                        timetable_uuid: timetableData.uuid,
                    },
                }
                );
            await DeparturesModel.bulkCreate(departuresToAdd);
            }
            
            //TIMETABLE PRICES
            if (data.timetablePrices) {
                let pricesToAdd = [];
                for (const prices of data.timetablePrices) {
                    for (const price of prices.prices) {
                    const harborFromData = harbors.find(
                        (harbor) => harbor.code === price.harbor_from_code
                    );
                    const harborToData = harbors.find(
                        (harbor) => harbor.code === price.harbor_to_code
                    );
                    const priceToAdd = {
                        uuid: crypto.randomUUID(16),
                        timetable_uuid: timetableData.uuid,
                        harbor_from: harborFromData.name,
                        harbor_from_code: harborFromData.code,
                        harbor_from_uuid: harborFromData.uuid,
                        harbor_to: harborToData.name,
                        harbor_to_code: harborToData.code,
                        harbor_to_uuid: harborToData.uuid,
                        ticket_type_uuid: prices.ticket_type.uuid,
                        ticket_type_name: prices.ticket_type.name,
                        seop_type: prices.ticket_type.seop_type,
                        is_island: prices.ticket_type.is_island === true,
                        ticket_type_name_eng: prices.ticket_type.name_eng,
                        price: price.price,
                        vat_base: price.vat_base,
                        vat_amount: price.vat_amount,
                        port_tax: price.port_tax,
                        is_active: true,
                    };
                    pricesToAdd = [...pricesToAdd, priceToAdd];
                    }
                }
                await TimetablePricesModel.update(
                    {
                        is_active: false,
                    },
                    {
                        where: {
                            timetable_uuid: timetableData.uuid,
                        },
                    }
                );
                await TimetablePricesModel.bulkCreate(pricesToAdd);
            }

            //ROUTES
            if(data.departuresForTimetable){ 
            let routesToAdd = [];
            const distinctSequence = await DeparturesModel.findAll({
                attributes: [
                    sequelize.fn("DISTINCT", sequelize.col("sequence")),
                    "sequence",
                ],
                where: { timetable_uuid: timetableData.uuid },
            });
            for (const sequence of distinctSequence) {
                const routesForSequence = departuresToAdd.filter(
                    (departure) => departure.sequence === sequence.sequence
                );
            for (const route of routesForSequence) {
                const routesOver = routesForSequence.filter(
                (over) => over.harbor_order >= route.harbor_order
                );
                for (const newRoute of routesOver) {
                const dateDEP = route.departure.split(" ")[0];
                const dateDEPrep1 = dateDEP.replaceAll(".", "/");
                const dateDEPrep = dateDEPrep1.slice(0, -1);
                const timeDEP = route.departure.split(" ")[1];
                const newRouteToAdd = {
                    uuid: crypto.randomUUID(16),
                    code:
                    timetableData.code +
                    route.departure_harbor_id +
                    newRoute.arrival_harbor_id +
                    route.sequence,
                    timetable_uuid: timetableData.uuid,
                    voyage_id: route.voyage_id,
                    departure_uuid: route.uuid,
                    sequence: route.sequence,
                    departure: dateFormater(route.departure),
                    actual_departure: dateFormater(route.departure),
                    departure_date: dateDEPrep,
                    departure_time: timeDEP,
                    arrival: dateFormater(newRoute.arrival),
                    actual_arrival: dateFormater(newRoute.arrival),
                    departure_harbor_order: route.harbor_order,
                    departure_harbor_id: route.departure_harbor_id,
                    departure_harbor_name: route.departure_harbor_name,
                    arrival_harbor_order: newRoute.harbor_order + 10,
                    arrival_harbor_id: newRoute.arrival_harbor_id,
                    arrival_harbor_name: newRoute.arrival_harbor_name,
                    timetable_code: timetableData.code,
                    timetable_name: timetableData.name,
                    line_uuid: timetableData.line_uuid,
                    line_code: timetableData.line_code,
                    line_name: timetableData.line_name,
                    //subsidised_tickets: data.line_data.subsidised_line,
                    label: timetableData.line_name,
                    direction: route.direction,
                    is_active: true,
                    is_actual: true,
                };
                routesToAdd = [...routesToAdd, newRouteToAdd];
                }
            }
            }
            console.log('ROUTES TO ADD ', routesToAdd)
            await RoutesModel.update(
                    {
                        is_active: false,
                    },
                    {
                        where: {
                            timetable_uuid: timetableData.uuid,
                        },
                    }
                );
                await RoutesModel.bulkCreate(routesToAdd);

                // Inicijaliziraj bookings za svaki origin departure (fire-and-forget,
                // izvodi se asinkrono — odgovor klijentu se ne čeka i kvar booking-servisa
                // ne sprečava spremanje timetable-a).
                const originDepartureUuids = [...new Set(routesToAdd.map((r) => r.departure_uuid))];
                initBookingsForDepartures(originDepartureUuids);
        }

            res.send({
                status:responseData.status,
                msg:responseData.msg,
                data:{
                    boats:boatsData
                }
            })
        });
    } catch (error) {
        console.error("Error in addTimetableDataController:", error);
        responseData.status = 500;
        responseData.msg = 'Error adding timetable data';
        res.status(500).json(responseData);
    }
}

module.exports = {
    getTimetableDataController,
    getTimetableDetailsController,
    addTimetableDataController
}