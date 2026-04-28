const { Client } = require("pg");

const admin = new Client({
    host: "kl-t4b-test-db-cluster-do-user-14047342-0.b.db.ondigitalocean.com",
    port: 25060,
    user: "doadmin",
    password: process.env.DB_PASS,
    database: "defaultdb",
    ssl: { rejectUnauthorized: false },
});

(async () => {
    try {
        await admin.connect();
        await admin.query(`CREATE DATABASE "travelo-booking-db"`);
        console.log("created travelo-booking-db");
    } catch (err) {
        if (String(err.message).includes("already exists")) {
            console.log("travelo-booking-db already exists");
        } else {
            console.error("FAILED:", err.message);
            process.exitCode = 1;
        }
    } finally {
        await admin.end();
    }
})();
