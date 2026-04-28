const axios = require("axios");
const { getCoreServiceConfigData } = require("../controllers/configSyncController");

async function bookingBase() {
    const cfg = await getCoreServiceConfigData();
    const url = cfg?.services?.booking?.url;
    if (!url) throw new Error("booking service URL missing in core config");
    return url;
}

// items: [{ route_uuid, ticket_type_uuid, qty }]
// On success: resolves with response body.
// On booking rejection (e.g. overbooking): throws Error with message from booking service.
async function reserveBookings(items) {
    const url = await bookingBase();
    const resp = await axios.post(`${url}/bookings/reserve`, { items }, {
        timeout: 10000,
        validateStatus: () => true,
    });
    if (resp.status !== 200) {
        const msg = resp.data?.data?.message || resp.data?.message || `booking reserve failed (status ${resp.status})`;
        const err = new Error(msg);
        err.bookingRejection = true;
        err.status = resp.status;
        throw err;
    }
    return resp.data;
}

// Release is non-blocking — log and continue on error (already-released tickets should not abort storno).
async function releaseBookings(items) {
    try {
        const url = await bookingBase();
        const resp = await axios.post(`${url}/bookings/release`, { items }, {
            timeout: 10000,
            validateStatus: () => true,
        });
        if (resp.status !== 200) {
            console.log("bookingClient.release non-200:", resp.status, resp.data);
        }
        return resp.data;
    } catch (err) {
        console.log("bookingClient.release error:", err?.message || err);
        return null;
    }
}

module.exports = { reserveBookings, releaseBookings };
