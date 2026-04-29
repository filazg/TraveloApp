const { getRoutesController, getPricesController } = require("../controllers/coreServiceControllers/salesServiceControllers");

const isFutureTrip = (trip) => {
    try {
        const now = new Date();
        const [d, m, rest] = trip.actual_departure.split(".");
        if (!d || !m || !rest) return true;
        const [yearPart, timePart] = rest.trim().split(" ");
        const year = parseInt(yearPart, 10);
        const month = parseInt(m, 10) - 1;
        const day = parseInt(d, 10);
        const [hh, mm] = (timePart || "00:00").split(":").map((v) => parseInt(v, 10));
        const departure = new Date(year, month, day, hh || 0, mm || 0);
        return departure.getTime() > now.getTime();
    } catch (_) {
        return true;
    }
};

const searchTripsHandler = async (body) => {
    const { travel_from, travel_to, travel_date } = body;
    const [year, month, day] = travel_date.split("-");
    const formattedTravelDate = `${day}/${month}/${year}`;

    const routesData = await getRoutesController();
    const pricesData = await getPricesController();

    const tripsForSearch = (routesData?.data?.routes || []).filter(
        (route) =>
            route.departure_harbor_id === travel_from &&
            route.arrival_harbor_id === travel_to &&
            route.departure_date === formattedTravelDate
    );

    const allPrices = pricesData?.data?.prices || [];
    const tripsForSend = [];

    for (const trip of tripsForSearch) {
        if (!isFutureTrip(trip)) continue;

        const ticketTypes = [
            ...new Map(
                allPrices
                    .filter((p) => p.timetable_uuid === trip.timetable_uuid)
                    .map((p) => [
                        p.ticket_type_uuid,
                        { ticket_type_uuid: p.ticket_type_uuid, ticket_type_name: p.ticket_type_name },
                    ])
            ).values(),
        ];

        const pricesForTrip = [];
        for (const ticketType of ticketTypes) {
            let priceRow =
                allPrices.find(
                    (p) =>
                        p.timetable_uuid === trip.timetable_uuid &&
                        p.harbor_from_code === trip.departure_harbor_id &&
                        p.harbor_to_code === trip.arrival_harbor_id &&
                        p.ticket_type_uuid === ticketType.ticket_type_uuid &&
                        p.seop_type !== "SEOP"
                ) ||
                allPrices.find(
                    (p) =>
                        p.timetable_uuid === trip.timetable_uuid &&
                        p.harbor_from_code === trip.arrival_harbor_id &&
                        p.harbor_to_code === trip.departure_harbor_id &&
                        p.ticket_type_uuid === ticketType.ticket_type_uuid
                );

            if (!priceRow) continue;

            pricesForTrip.push({
                ticket_type_uuid: ticketType.ticket_type_uuid,
                ticket_type_name: ticketType.ticket_type_name,
                price: Number(priceRow.price),
                capacity: 100,
                description: priceRow.description,
            });
        }

        tripsForSend.push({
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
            prices: pricesForTrip,
        });
    }

    return tripsForSend;
};

module.exports = { searchTripsHandler };
