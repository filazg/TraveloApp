const axios = require("axios");
const https = require("https");
const { bookingModel } = require("../db/models/BookingData.cjs");
const { pairingDataModel } = require("../db/models/Pairing.cjs");
const { systemSettingsDataModel } = require("../db/models/Settings.cjs");

const getBookingDataService = async(data) =>{
    try {
        console.log('DATA U BOOKING SERVICE',data)
        const settingsData = await systemSettingsDataModel.findOne();
        const backendUrl = settingsData?.backend_url;
        if (!backendUrl) {
            throw new Error('backend_url nije postavljen u Settings.');
        }
        const pairingData = await pairingDataModel.findOne();
        const token = pairingData?.token;
        const dataToSend = {
            timetable_uuid:data.timetable_uuid,
            sequence:data.sequence
        }
        const response = await axios.post(backendUrl + '/terminals/terminal/booking', dataToSend, {
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            headers: {
              authorization: "Bearer " + token,
            },
          })
          console.log('BOOKING RESP length', Array.isArray(response.data) ? response.data.length : '(not array)');
          // Gateway unwrappa pa response.data je već niz; ako se zove direktno (bez gatewaya)
          // payload je { status, data: [...] }.
          const bookings = Array.isArray(response.data)
            ? response.data
            : (Array.isArray(response.data?.data) ? response.data.data : []);
          await bookingModel.destroy({
            where:{
                timetable_uuid:data.timetable_uuid,
                sequence:data.sequence
            }
            });
          if (bookings.length > 0) {
            await bookingModel.bulkCreate(bookings);
          }
    } catch (error) {
        console.log('BOOKING ERROR', error?.response?.data || error?.message || error)
    }
    const bookingToSend = await bookingModel.findAll({
        where:{
            timetable_uuid:data.timetable_uuid,
            sequence:data.sequence
        }, attributes:{ exclude: ["createdAt", "updatedAt"] }})
    let dataToSendd = []
        for(const book of bookingToSend){
            console.log('PRINT BOOKING')
            console.log(book.id)
            const newBook = {
                id:book.id,
                sales_route_uuid:book.routes_uuid,
                departure_harbor_order: book.departure_harbor_order,
                arrival_harbor_order: book.arrival_harbor_order,
                departure_harbor_id: book.departure_harbor_id,
                arrival_harbor_id: book.arrival_harbor_id,
                passanger_free:book.passanger_capacity - book.passanger_occupied,
                vip_free:book.passanger_vip_capacity - book.passanger_vip_occupied,
                pets_free:book.pets_capacity - book.pets_occupied,
                bicycle_free:book.bicycle_capacity - book.bicycle_occupied,
            }
            dataToSendd = [...dataToSendd, newBook]
        }
    return dataToSendd
}

module.exports = {
    getBookingDataService
}