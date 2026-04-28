const axios = require("axios");
const { getCoreServiceConfigData } = require("../../controllers/configServices/configSyncController");

// Pivots per-leg-per-category rows from booking-service into the legacy
// per-leg shape that the boat-desk client persists locally.
const handleGetBookingDataDeskTerminalsFeature = async (req, res) => {
    try {
        const data = req.body?.body || req.body || {};
        const { timetable_uuid, sequence } = data;
        if (!timetable_uuid || sequence == null) {
            return res.status(400).send({ status: 400, data: { message: "timetable_uuid and sequence are required" } });
        }

        const coreConfig = await getCoreServiceConfigData();
        const bookingUrl = coreConfig?.services?.booking?.url;
        if (!bookingUrl) {
            return res.status(500).send({ status: 500, data: { message: "booking service URL not configured" } });
        }

        const resp = await axios.get(`${bookingUrl}/bookings`, {
            params: { timetable_uuid, sequence },
            timeout: 8000,
            validateStatus: () => true,
        });
        if (resp.status !== 200) {
            return res.status(resp.status).send({ status: resp.status, data: resp.data });
        }
        const bookings = resp.data?.data?.bookings || [];

        const byRoute = new Map();
        for (const b of bookings) {
            const key = b.route_uuid;
            if (!byRoute.has(key)) {
                byRoute.set(key, {
                    booking_uuid: b.booking_uuid,
                    timetable_uuid: b.timetable_uuid,
                    departure_uuid: b.departure_uuid,
                    routes_uuid: b.route_uuid,
                    voyage_id: b.departure_uuid,
                    sequence: b.sequence,
                    departure: null,
                    actual_departure: null,
                    departure_harbor_order: b.departure_harbor_order,
                    departure_harbor_id: b.departure_harbor_id,
                    departure_harbor_name: b.departure_harbor_name,
                    arrival: null,
                    actual_arrival: null,
                    arrival_harbor_order: b.arrival_harbor_order,
                    arrival_harbor_id: b.arrival_harbor_id,
                    arrival_harbor_name: b.arrival_harbor_name,
                    timetable_code: null,
                    timetable_name: null,
                    line_uuid: null,
                    line_code: b.line_code,
                    line_name: b.line_name,
                    label: null,
                    direction: null,
                    passanger_capacity: 0,
                    passanger_vip_capacity: 0,
                    pets_capacity: 0,
                    bicycle_capacity: 0,
                    passanger_in: 0,
                    passanger_vip_in: 0,
                    pets_in: 0,
                    bicycle_in: 0,
                    passanger_out: 0,
                    passanger_vip_out: 0,
                    pets_out: 0,
                    bicycle_out: 0,
                    passanger_occupied: 0,
                    passanger_vip_occupied: 0,
                    pets_occupied: 0,
                    bicycle_occupied: 0,
                    booking_is_active: !!b.is_active,
                });
            }
            const row = byRoute.get(key);
            const total = (Number(b.capacity_base) || 0) + (Number(b.capacity_additional) || 0);
            switch (String(b.category_code || "").toUpperCase()) {
                case "PASSANGER":
                    row.passanger_capacity = total;
                    row.passanger_occupied = Number(b.occupied) || 0;
                    row.passanger_in = Number(b.in_count) || 0;
                    row.passanger_out = Number(b.out_count) || 0;
                    break;
                case "VIP":
                    row.passanger_vip_capacity = total;
                    row.passanger_vip_occupied = Number(b.occupied) || 0;
                    row.passanger_vip_in = Number(b.in_count) || 0;
                    row.passanger_vip_out = Number(b.out_count) || 0;
                    break;
                case "PETS":
                    row.pets_capacity = total;
                    row.pets_occupied = Number(b.occupied) || 0;
                    row.pets_in = Number(b.in_count) || 0;
                    row.pets_out = Number(b.out_count) || 0;
                    break;
                case "BICYCLE":
                    row.bicycle_capacity = total;
                    row.bicycle_occupied = Number(b.occupied) || 0;
                    row.bicycle_in = Number(b.in_count) || 0;
                    row.bicycle_out = Number(b.out_count) || 0;
                    break;
            }
        }

        res.send({ status: 200, data: Array.from(byRoute.values()) });
    } catch (error) {
        console.log("handleGetBookingDataDeskTerminalsFeature error:", error?.message || error);
        res.status(500).send({ status: 500, error: error.message });
    }
};

module.exports = {
    handleGetBookingDataDeskTerminalsFeature,
};
