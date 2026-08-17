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

const transactionsBase = async () => {
    const cfg = await getCoreServiceConfigData();
    return cfg.services.transactions?.url;
};

// "17.08.2026. 09:00" ili "2026-08-17 09:00" → "2026-08-17".
// tickets_search traži datum, a polasci ga nose kao slobodan tekst.
const isoDateFromDeparture = (value) => {
    const s = String(value || '').trim();
    if (!s) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const hr = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(s);
    if (hr) {
        const [, d, m, y] = hr;
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    if (slash) {
        const [, d, m, y] = slash;
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
};

/**
 * Validirane karte po luci ukrcaja i kategoriji.
 *
 * Validacija na terminalu mijenja samo status karte, brojač na booking retku
 * nitko ne održava — zato se broji iz samih karata. Time je podatak i otporan
 * na storno i na ponovni init booking redaka: karta koja više nije validirana
 * jednostavno se ne prebroji.
 *
 * Karte se traže po route_uuid-ovima polaska (jedinstveni su po vozni red +
 * sekvenca + datum, pa implicitno određuju baš taj polazak).
 */
const validatedCountsForVoyage = async (legs, departurePlaned) => {
    const routeUuids = (legs || []).map((l) => l.uuid).filter(Boolean);
    const date = isoDateFromDeparture(departurePlaned);
    if (!routeUuids.length || !date) return null;

    const tUrl = await transactionsBase();
    const bUrl = await bookingBase();
    if (!tUrl || !bUrl) return null;

    const [ticketsResp, mappingsResp] = await Promise.all([
        axios.get(tUrl + '/tickets_search', {
            params: { date, route_uuids: routeUuids.join(','), status: 'validated', limit: 5000 },
            timeout: 8000,
            validateStatus: () => true,
        }),
        axios.get(bUrl + '/ticket_type_mappings', { timeout: 6000, validateStatus: () => true }),
    ]);
    if (ticketsResp.status !== 200) return null;

    const tickets = ticketsResp.data?.data?.tickets || ticketsResp.data?.tickets || [];
    const mappings = mappingsResp.status === 200
        ? (mappingsResp.data?.data?.mappings || mappingsResp.data?.mappings || [])
        : [];
    const categoryByType = new Map(mappings.map((m) => [m.ticket_type_uuid, m.category_code]));

    const counts = {};
    for (const t of tickets) {
        if (t.is_canceled) continue;
        const category = categoryByType.get(t.ticket_type_uuid);
        if (!category) continue;
        const harbor = t.departure_harbor_id;
        if (!harbor) continue;
        counts[harbor] = counts[harbor] || {};
        counts[harbor][category] = (counts[harbor][category] || 0) + 1;
    }
    return counts;
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
        if (merged.data) {
            // Validirano se ne vodi kao brojač nego se broji iz karata polaska.
            try {
                const counts = await validatedCountsForVoyage(
                    merged.data.legs,
                    merged.data.sailing?.departure_planed || merged.data.sailing?.departure,
                );
                if (counts) {
                    for (const b of bookings) {
                        b.validated = counts[b.departure_harbor_id]?.[b.category_code] || 0;
                    }
                }
            } catch (e) {
                // Bez brojanja Kapetan i dalje radi — samo ostaje spremljena vrijednost.
                console.log('sailing validated counts failed:', e?.message || e);
            }
            merged.data.bookings = bookings;
        }
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
