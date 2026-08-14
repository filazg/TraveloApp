const axios = require('axios');
const { getCoreServiceConfigData } = require('../../configServices/configSyncController');

const boatBase = async () => {
    const cfg = await getCoreServiceConfigData();
    return cfg.services.boat.url;
};

const bookingBase = async () => {
    const cfg = await getCoreServiceConfigData();
    return cfg.services.booking?.url;
};

const getSailingsController = async (params = {}) => {
    try {
        const url = await boatBase();
        const response = await axios.get(url + '/sailings', { params, validateStatus: () => true });
        const body = response.data || {};
        const include = String(params?.include || "");
        // Optionally enrich each sailing with its bookings. Booking-service
        // normalizira departure_uuid na kanonski voyage uuid (prvi leg) pa
        // dovoljan je jedan poziv po sailing-u — vraća sve adjacent leg row-ove.
        if (include.includes('bookings') && body?.data?.sailings?.length) {
            const bUrl = await bookingBase();
            if (bUrl) {
                await Promise.all(
                    body.data.sailings.map(async (sailing) => {
                        if (!sailing.uuid) {
                            sailing.bookings = [];
                            return;
                        }
                        try {
                            const r = await axios.get(bUrl + '/bookings', {
                                params: { departure_uuid: sailing.uuid },
                                timeout: 6000,
                                validateStatus: () => true,
                            });
                            sailing.bookings = r.status === 200
                                ? (r.data?.data?.bookings || r.data?.bookings || [])
                                : [];
                        } catch (e) {
                            console.log('sailing bookings fetch error for', sailing.uuid, ':', e?.message || e);
                            sailing.bookings = [];
                        }
                    })
                );
            }
        }
        return body;
    } catch (error) {
        console.log('getSailingsController error:', error?.message || error);
        return { status: 500, data: { message: error.message } };
    }
};

const getSailingDetailsController = async (uuid) => {
    try {
        const url = await boatBase();
        const bUrl = await bookingBase();
        const sailingResp = await axios.get(url + '/sailings/' + uuid, { validateStatus: () => true });

        let bookings = [];
        if (bUrl) {
            const fetchBookings = async () => {
                const r = await axios.get(bUrl + '/bookings', { params: { departure_uuid: uuid }, validateStatus: () => true });
                return r.status === 200 ? (r.data?.data?.bookings || r.data?.bookings || []) : [];
            };
            bookings = await fetchBookings();
            // Auto-init booking rows if none exist for this voyage — gives Kapetan a full capacity snapshot
            // even before the first ticket is sold.
            if (bookings.length === 0) {
                try {
                    await axios.post(bUrl + '/bookings/init', { departure_uuid: uuid }, { timeout: 8000, validateStatus: () => true });
                    bookings = await fetchBookings();
                } catch (e) {
                    console.log('sailing auto-init bookings failed:', e?.message || e);
                }
            }
        }

        const merged = sailingResp.data || {};
        if (merged.data) merged.data.bookings = bookings;
        return merged;
    } catch (error) {
        console.log('getSailingDetailsController error:', error?.message || error);
        return { status: 500, data: { message: error.message } };
    }
};

const startSailingController = async (data) => {
    try {
        const url = await boatBase();
        const response = await axios.post(url + '/sailing/start', data, { validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('startSailingController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

const updateLegStatusController = async (data) => {
    try {
        const url = await boatBase();
        const response = await axios.post(url + '/sailing/update_leg', data, { validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('updateLegStatusController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

const cancelHarborArrivalController = async (data) => {
    try {
        const url = await boatBase();
        const response = await axios.post(url + '/sailing/cancel_arrival', data, { validateStatus: () => true });
        return { status: response.status, body: response.data };
    } catch (error) {
        console.log('cancelHarborArrivalController error:', error?.message || error);
        return { status: 500, body: { data: { message: error.message } } };
    }
};

// Zamjena plovila na polasku: boat servis prepiše plovilo i bazne kapacitete na
// svim legovima voyage-a, pa booking servis prekalkulira capacity_base po
// kategoriji. Redoslijed je bitan — booking čita nove vrijednosti s departures.
const changeBoatController = async (data) => {
    try {
        const url = await boatBase();
        const response = await axios.post(url + '/dispatcher/change_boat', data, { validateStatus: () => true });
        if (response.status !== 200 || response.data?.status !== 200) {
            return { status: response.data?.status || response.status, body: response.data };
        }

        const result = response.data?.data || {};
        const bUrl = await bookingBase();
        let recalc = null;
        if (bUrl) {
            const departureUuid = result.canonical_departure_uuid || (data?.body || data)?.departure_uuid;
            const r = await axios.post(
                bUrl + '/bookings/recalc_capacity',
                { departure_uuid: departureUuid },
                { timeout: 8000, validateStatus: () => true }
            );
            // Bookings možda još ne postoje (nijedna karta nije prodana) — tada
            // nema što prekalkulirati i to nije greška.
            recalc = r.status === 200 ? (r.data?.data || null) : { error: r.data?.data?.message || `HTTP ${r.status}` };
        }
        return { status: 200, body: { status: 200, data: { ...result, recalc } } };
    } catch (error) {
        console.log('changeBoatController error:', error?.message || error);
        return { status: 500, body: { status: 500, data: { message: error.message } } };
    }
};

module.exports = {
    getSailingsController,
    getSailingDetailsController,
    startSailingController,
    updateLegStatusController,
    cancelHarborArrivalController,
    changeBoatController,
};
