const crypto = require("node:crypto");
const { getRoutesController, getPricesController } = require("../controllers/coreServiceControllers/salesServiceControllers")

const searchTripsHandlers = async(data)=>{
    try {
        console.log(data)
        const travelDate = data.body.travel_date
        const [year, month, day] = travelDate.split("-");
        const formattedTravelDate = `${day}/${month}/${year}`; 
        const checkControlCode = crypto
            .createHash("sha512")
            .update(data.header.k + data.body.travel_from + data.body.travel_date + data.body.travel_to)
            .digest("hex")
            console.log(checkControlCode)
        const routesData = await getRoutesController()
        const pricesData = await getPricesController()
        if(checkControlCode === data.body.control_code){
            const tripsForSearch = await routesData.data.routes.filter((route)=>
                route.departure_harbor_id === data.body.travel_from &&
                route.arrival_harbor_id === data.body.travel_to &&
                route.departure_date === formattedTravelDate
            )
            console.log('trip', tripsForSearch)
            let tripsForSend = [];
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

            if(tripsForSearch){
                for(const trip of tripsForSearch){
                    console.log('ovo je trip:', trip)
                    let pricesForTrip = []
                    if(isFutureInTrip){
                        const priceTicketType = [
                            ...new Map(
                                pricesData.data.prices
                                .filter(p => p.timetable_uuid === trip.timetable_uuid)
                                .map(p => [p.ticket_type_uuid, {
                                    ticket_type_uuid: p.ticket_type_uuid,
                                    ticket_type_name: p.ticket_type_name
                                }])
                            ).values()
                        ];
                        console.log('PRICE ', pricesData.data.prices[0])
                        for(const ticketType of priceTicketType){
                            console.log('TICKET TYPE ', ticketType)
                            let pricesForTicketType = {}

                            const pricesForTicketTypeData = await pricesData.data.prices.find((price)=>
                                price.timetable_uuid === trip.timetable_uuid &&
                                price.harbor_from_code === trip.departure_harbor_id &&
                                price.harbor_to_code === trip.arrival_harbor_id &&
                                price.ticket_type_uuid === ticketType.ticket_type_uuid &&
                                price.seop_type !== 'SEOP'
                            )
                            if(!pricesForTicketTypeData){
                                const pricesForTicketTypeDataReverse = await pricesData.data.prices.find((price)=>
                                    price.timetable_uuid === trip.timetable_uuid &&
                                    price.harbor_from_code === trip.arrival_harbor_id &&
                                    price.harbor_to_code === trip.departure_harbor_id &&
                                    price.ticket_type_uuid === ticketType.ticket_type_uuid
                                )
                                pricesForTicketType = pricesForTicketTypeDataReverse  
                            }else{
                                pricesForTicketType = pricesForTicketTypeData
                            }

                            const priceToAdd = {
                                //id:pricesForTicketType.id,
                                ticket_type_uuid:ticketType.ticket_type_uuid,   
                                ticket_type_name:ticketType.ticket_type_name, 
                                price:Number(pricesForTicketType.price),
                                //vat_base:pricesForTicketType.vat_base,
                                //vat:pricesForTicketType.vat_amount,
                                //harbor_tax:pricesForTicketType.port_tax,
                                capacity:100,
                                description:pricesForTicketType.description,
                            }
                            pricesForTrip = [...pricesForTrip, priceToAdd]
                        }
                    }
                    const newTrip = {
                         //id: trip.id,
                            uuid: trip.uuid, 
                            trip_uuid: trip.uuid, 
                            departure: trip.actual_departure, 
                            arrival: trip.actual_arrival, 
                            departure_harbor_id: trip.departure_harbor_id, 
                            departure_harbor_name: trip.departure_harbor_name, 
                            arrival_harbor_id: trip.arrival_harbor_id, 
                            arrival_harbor_name: trip.arrival_harbor_name, 
                            line_uuid: trip.line_uuid, 
                            line_code: trip.line_code, 
                            line_name: trip.line_name, 
                            prices: pricesForTrip
                        }
                        tripsForSend = [...tripsForSend, newTrip];
                }
                    return({
                        status:'ok',
                        data:tripsForSend
                    })
            }
        }else{
            return({
                        status:'ok',
                        data:'invalid control code'
                    })
            console.log('invalid control code')   
        }
    } catch (error) {
        console.log(error)
        
    }
}

module.exports = {
    searchTripsHandlers
}