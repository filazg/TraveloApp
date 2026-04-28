const { Sequelize } = require('sequelize');
const { Op } = require("sequelize");
const dayjs = require('dayjs');

const searchTripsController = async(req,res)=>{
    const { RoutesModel, TimetablePricesModel } = req.app.locals.models;  
    console.log('SEARCH', req.body)
    try {
      const data = req.body;
      const date = new Date(req.body.travel_date);
      function padTo2Digits(num) {
        return num.toString().padStart(2, "0");
      }
  
      function formatDate(date) {
        return [
          padTo2Digits(date.getDate()),
          padTo2Digits(date.getMonth() + 1),
          date.getFullYear(),
        ].join(".");
      }
   
      const travelDate = formatDate(new Date(date));
      const today = dayjs(new Date()).format("DD.MM.YYYY HH:mm");
      console.log(travelDate) 
  
      const tripsForSearch = await RoutesModel.findAll({
        where: {
          departure_harbor_id: data.travel_from.code,
          arrival_harbor_id: data.travel_to.code,
          actual_departure: {
            [Op.like]: `${travelDate}%`
          },
        },
      });
      console.log('broj putovanja ', tripsForSearch.length)


      //dodavanje kapaciteta i cijena putovanja -> liste objekata capacity i prices
      //kapacitet ide iz bookinga koji se publisha kod svake promjene na sve kanale prodaje po relaciji
      //console.log('trips for search')
      //console.log(tripsForSearch)
      let tripsResult = [];

      //provjera za danasnje polaske da li je prosao

      const isFutureInTrip = (trip) => {
        console.log('is future trip funkcija')
        console.log(trip.actual_departure)
        console.log(today)
        console.log('is future trip funkcija')
        const travelD =  trip.actual_departure.split(". ");
        const todayD = today.split(" ");
        if (travelD[0] === todayD[0]) {
          console.log('isti dan')
          console.log(travelD[1])
          console.log(today[1])
          const travelTime = travelD[1].split(":");
          const todayTime = todayD[1].split(":");
          if(parseInt(travelTime[0]) < parseInt(todayTime[0])){
            return false;
          }else if(parseInt(travelTime[0]) === parseInt(todayTime[0])){
            if(parseInt(travelTime[1]) <= parseInt(todayTime[1])){
              return false;
            }else{
              return true;
            }
          }else{
            return true;
          } 
        }else{
          return true;
        }
      }

      if (tripsForSearch) {
        for (const trip of tripsForSearch) {
          if(isFutureInTrip(trip)){

        
          console.log(trip)
          
          const priceForTrip = await TimetablePricesModel.findAll({
            where:{
              timetable_uuid:trip.timetable_uuid
  
            }
          })
          
          const priceTicketType = await TimetablePricesModel.findAll({
              attributes: [
                  Sequelize.fn('DISTINCT', Sequelize.col('ticket_type_uuid')), 'ticket_type_uuid', 'ticket_type_name'
              ],
              where: { timetable_uuid:trip.timetable_uuid }
          })
          let pricesForTrip = []
          for(const ticketType of priceTicketType){
            let pricesForTicketType = {}
            
            const pricesForTicketTypeData = await TimetablePricesModel.findOne({
              where:{
                timetable_uuid:trip.timetable_uuid,
                harbor_from_code:trip.departure_harbor_id,
                harbor_to_code:trip.arrival_harbor_id,
                ticket_type_uuid:ticketType.ticket_type_uuid
              }
            })
            
            //console.log(pricesForTicketTypeData)
            if(!pricesForTicketTypeData){
              console.log('prices ne  exist')
              
              const pricesForTicketTypeDataReverse = await TimetablePricesModel.findOne({
                where:{
                  timetable_uuid:trip.timetable_uuid,
                  harbor_from_code:trip.arrival_harbor_id,
                  harbor_to_code:trip.departure_harbor_id,
                  ticket_type_uuid:ticketType.ticket_type_uuid
                }
              })
              //console.log(pricesForTicketTypeDataReverse)
              const pricesToAdd = {
                id:pricesForTicketTypeDataReverse.id,
                ticket_type_uuid:ticketType.ticket_type_uuid,
                ticket_type_name:ticketType.ticket_type_name,
                price:pricesForTicketTypeDataReverse.price,
                is_island:pricesForTicketTypeDataReverse.is_island === true,
                seop_type:pricesForTicketTypeDataReverse.seop_type,
                vat_base:pricesForTicketTypeDataReverse.vat_base,
                vat:pricesForTicketTypeDataReverse.vat_amount,
                harbor_tax:pricesForTicketTypeDataReverse.port_tax,
                description:pricesForTicketTypeDataReverse.ticket_type_description,
              }
              pricesForTrip = [...pricesForTrip, pricesToAdd]
            }else{
              const pricesToAdd = {
                id:pricesForTicketTypeData.id,
                ticket_type_uuid:ticketType.ticket_type_uuid,
                ticket_type_name:ticketType.ticket_type_name,
                price:pricesForTicketTypeData.price,
                is_island:pricesForTicketTypeData.is_island === true,
                seop_type:pricesForTicketTypeData.seop_type,
                vat_base:pricesForTicketTypeData.vat_base,
                vat:pricesForTicketTypeData.vat_amount,
                harbor_tax:pricesForTicketTypeData.port_tax,
                description:pricesForTicketTypeData.ticket_type_description,
              }
              pricesForTrip = [...pricesForTrip, pricesToAdd]
            }
            
          }
          const newTrip = {
            id: trip.id,
            uuid: trip.uuid,
            time_table_uuid:trip.timetable_uuid,
            departure:trip.departure,
            actual_departure:trip.actual_departure,
            arrival:trip.arrival,
            actual_arrival:trip.actual_arrival,
            departure_harbor_order:trip.departure_harbor_order,
            departure_harbor_id:trip.departure_harbor_id,
            departure_harbor_name:trip.departure_harbor_name,
            //arrival_harbor_order:trip.arrival_harbor_order,
            arrival_harbor_id:trip.arrival_harbor_id,
            arrival_harbor_name:trip.arrival_harbor_name,
            line_uuid:trip.line_uuid,
            line_code: trip.line_code,
            line_name: trip.line_name,
            //capacity:capacityForTrip,
            prices:pricesForTrip
          };
          tripsResult = [...tripsResult, newTrip];
        }
      }
      }



        res.send({
            status:200,                
            path:'tripsData',
            data: {
              trips:tripsResult
            }              
        })
    } catch (error) {
        console.log('ERROR' , error)
        res.send({
            status:500             
        })
    }
}
const searchWebPageTripsController = async(req,res)=>{
    const { RoutesModel, TimetablePricesModel } = req.app.locals.models;  
    console.log('SEARCH', req.body)
    try {
      const data = req.body;
      const date = new Date(req.body.travel_date);
      function padTo2Digits(num) {
        return num.toString().padStart(2, "0");
      }
  
      function formatDate(date) {
        return [
          padTo2Digits(date.getDate()),
          padTo2Digits(date.getMonth() + 1),
          date.getFullYear(),
        ].join(".");
      }
   
      const travelDate = formatDate(new Date(date));
      const today = dayjs(new Date()).format("DD.MM.YYYY HH:mm");
      console.log(travelDate) 
  
      const tripsForSearch = await RoutesModel.findAll({
        where: {
          departure_harbor_id: data.travel_from_code,
          arrival_harbor_id: data.travel_to_code,
          actual_departure: {
            [Op.like]: `${travelDate}%`
          },
        },
      });
      console.log('broj putovanja ', tripsForSearch.length)


      //dodavanje kapaciteta i cijena putovanja -> liste objekata capacity i prices
      //kapacitet ide iz bookinga koji se publisha kod svake promjene na sve kanale prodaje po relaciji
      //console.log('trips for search')
      //console.log(tripsForSearch)
      let tripsResult = [];

      //provjera za danasnje polaske da li je prosao

      const isFutureInTrip = (trip) => {
        console.log('is future trip funkcija')
        console.log(trip.actual_departure)
        console.log(today)
        console.log('is future trip funkcija')
        const travelD =  trip.actual_departure.split(". ");
        const todayD = today.split(" ");
        if (travelD[0] === todayD[0]) {
          console.log('isti dan')
          console.log(travelD[1])
          console.log(today[1])
          const travelTime = travelD[1].split(":");
          const todayTime = todayD[1].split(":");
          if(parseInt(travelTime[0]) < parseInt(todayTime[0])){
            return false;
          }else if(parseInt(travelTime[0]) === parseInt(todayTime[0])){
            if(parseInt(travelTime[1]) <= parseInt(todayTime[1])){
              return false;
            }else{
              return true;
            }
          }else{
            return true;
          } 
        }else{
          return true;
        }
      }

      if (tripsForSearch) {
        for (const trip of tripsForSearch) {
          if(isFutureInTrip(trip)){

        
          console.log(trip)
          
          const priceForTrip = await TimetablePricesModel.findAll({
            where:{
              timetable_uuid:trip.timetable_uuid
  
            }
          })
          
          const priceTicketType = await TimetablePricesModel.findAll({
              attributes: [
                  Sequelize.fn('DISTINCT', Sequelize.col('ticket_type_uuid')), 'ticket_type_uuid', 'ticket_type_name'
              ],
              where: { timetable_uuid:trip.timetable_uuid }
          })
          let pricesForTrip = []
          for(const ticketType of priceTicketType){
            let pricesForTicketType = {}
            
            const pricesForTicketTypeData = await TimetablePricesModel.findOne({
              where:{
                timetable_uuid:trip.timetable_uuid,
                harbor_from_code:trip.departure_harbor_id,
                harbor_to_code:trip.arrival_harbor_id,
                ticket_type_uuid:ticketType.ticket_type_uuid
              }
            })
            
            //console.log(pricesForTicketTypeData)
            if(!pricesForTicketTypeData){
              console.log('prices ne  exist')
              
              const pricesForTicketTypeDataReverse = await TimetablePricesModel.findOne({
                where:{
                  timetable_uuid:trip.timetable_uuid,
                  harbor_from_code:trip.arrival_harbor_id,
                  harbor_to_code:trip.departure_harbor_id,
                  ticket_type_uuid:ticketType.ticket_type_uuid
                }
              })
              //console.log(pricesForTicketTypeDataReverse)
              const pricesToAdd = {
                id:pricesForTicketTypeDataReverse.id,
                ticket_type_uuid:ticketType.ticket_type_uuid,
                ticket_type_name:ticketType.ticket_type_name,
                price:pricesForTicketTypeDataReverse.price,
                is_island:pricesForTicketTypeDataReverse.is_island === true,
                seop_type:pricesForTicketTypeDataReverse.seop_type,
                vat_base:pricesForTicketTypeDataReverse.vat_base,
                vat:pricesForTicketTypeDataReverse.vat_amount,
                harbor_tax:pricesForTicketTypeDataReverse.port_tax,
                description:pricesForTicketTypeDataReverse.ticket_type_description,
              }
              pricesForTrip = [...pricesForTrip, pricesToAdd]
            }else{
              const pricesToAdd = {
                id:pricesForTicketTypeData.id,
                ticket_type_uuid:ticketType.ticket_type_uuid,
                ticket_type_name:ticketType.ticket_type_name,
                price:pricesForTicketTypeData.price,
                is_island:pricesForTicketTypeData.is_island === true,
                seop_type:pricesForTicketTypeData.seop_type,
                vat_base:pricesForTicketTypeData.vat_base,
                vat:pricesForTicketTypeData.vat_amount,
                harbor_tax:pricesForTicketTypeData.port_tax,
                description:pricesForTicketTypeData.ticket_type_description,
              }
              pricesForTrip = [...pricesForTrip, pricesToAdd]
            }
            
          }
          const newTrip = {
            id: trip.id,
            uuid: trip.uuid,
            time_table_uuid:trip.timetable_uuid,
            departure:trip.departure,
            actual_departure:trip.actual_departure,
            arrival:trip.arrival,
            actual_arrival:trip.actual_arrival,
            departure_harbor_order:trip.departure_harbor_order,
            departure_harbor_id:trip.departure_harbor_id,
            departure_harbor_name:trip.departure_harbor_name,
            //arrival_harbor_order:trip.arrival_harbor_order,
            arrival_harbor_id:trip.arrival_harbor_id,
            arrival_harbor_name:trip.arrival_harbor_name,
            line_uuid:trip.line_uuid,
            line_code: trip.line_code,
            line_name: trip.line_name,
            //capacity:capacityForTrip,
            prices:pricesForTrip
          };
          tripsResult = [...tripsResult, newTrip];
        }
      }
      }



        res.send({
            status:200,                
            trips:tripsResult            
        })
    } catch (error) {
        console.log('ERROR' , error)
        res.send({
            status:500             
        })
    }
}

module.exports = {
  searchTripsController,
  searchWebPageTripsController
}