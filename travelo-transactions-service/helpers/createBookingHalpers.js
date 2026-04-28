const { getModels } = require("../dbModels");

const createBookingHelper = async(data)=>{
    try {
        console.log('tu smo create booking')
        const { BookingModel } = getModels();
        //const timetableData = data.timetable
        const routesData = data.routes
        const localBookingData = await BookingModel.findAll({
            where:{
                timetable_uuid:data.timetable_uuid
            }
        }) 
        let bookingToAdd = []
        for(const route of routesData){
            const bookingExist = localBookingData.find((book)=>book.routes_uuid === route.uuid)
            if(bookingExist){
                //update booking data - dodati tko je updateao
                await BookingModel.update({
                    voyage_id:route.voyage_id,
                    actual_departure:route.actual_departure,
                    actual_arrival:route.actual_arrival,
                    passanger_capacity:route.passanger_capacity,
                    passanger_vip_capacity:route.passanger_vip_capacity,
                    pets_capacity:route.pets_capacity,
                    bicycle_capacity:route.bicycle_capacity,
                    additional_passanger_capacity:data.additional_passanger_capacity,
                    additional_passanger_vip_capacity:data.additional_passanger_vip_capacity,
                    additional_pets_capacity:data.additional_pets_capacity,
                    additional_bicycle_capacity:data.additional_bicycle_capacity,
                    booking_is_active:route.booking_is_active,
                },{
                    where:{
                        routes_code: route.code
                    }
                })
            }else{
                //create booking data - dodati tko je updateao
                const newBooking = {
                    uuid:crypto.randomUUID(16),
                    timetable_uuid:route.timetable_uuid,
                    departure_uuid:route.departure_uuid,
                    routes_uuid:route.uuid,
                    routes_code:route.code,
                    voyage_id:route.voyage_id,
                    sequence:route.sequence,
                    departure:route.departure,
                    actual_departure:route.actual_departure,
                    departure_harbor_order:route.departure_harbor_order,
                    departure_harbor_id:route.departure_harbor_id,
                    departure_harbor_name:route.departure_harbor_name,
                    arrival:route.arrival,
                    actual_arrival:route.actual_arrival,
                    arrival_harbor_order:route.arrival_harbor_order,
                    arrival_harbor_id:route.arrival_harbor_id,
                    arrival_harbor_name:route.arrival_harbor_name,
                    timetable_code:route.timetable_code,
                    timetable_name:route.timetable_name,
                    line_uuid:route.line_uuid,
                    line_code:route.line_code,
                    line_name:route.line_name,
                    label:route.label,
                    direction:route.direction,
                    passanger_capacity:320,
                    passanger_vip_capacity:25,
                    pets_capacity:15,
                    bicycle_capacity:30,
                    additional_passanger_capacity:0,
                    additional_passanger_vip_capacity:0,
                    additional_pets_capacity:0,
                    additional_bicycle_capacity:0,
                    passanger_in:0,
                    passanger_vip_in:0,
                    pets_in:0,
                    bicycle_in:0,
                    passanger_out:0,
                    passanger_vip_out:0,
                    pets_out:0,
                    bicycle_out:0,
                    passanger_occupied:0,
                    passanger_vip_occupied:0,
                    pets_occupied:0,
                    bicycle_occupied:0,
                    passanger_validate:0,
                    passanger_vip_validate:0,
                    pets_validate:0,
                    bicycle_validate:0,
                    booking_is_active:true
                }
                bookingToAdd = [...bookingToAdd, newBooking]
            }
        
        }
        await BookingModel.bulkCreate(bookingToAdd)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    createBookingHelper
}