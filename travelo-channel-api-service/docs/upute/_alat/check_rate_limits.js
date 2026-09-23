#!/usr/bin/env node
// Provjera ogranicenja ucestalosti na partnerskom API-ju.
//
//   node docs/upute/_alat/check_rate_limits.js [osnovna-adresa]
//
// Namjerno NIJE u Postman kolekciji koju dobiva partner: test je smislen samo
// ako se namjerno zapuca vise stotina zahtjeva, a to nije nesto sto partner
// treba klikati. Ovdje stoji kao alat za nas.
//
// Ocekivanja prate `middlewares/rateLimiters.js`:
//   /auth/api_sales_login   10 / min po IP-u   (obrana od pogadanja OTP-a)
//   zasticene rute         120 / min po partneru
//   /documentation          30 / min po IP-u
//
// Vazno: brojaci se drze u memoriji procesa i traju minutu. Nakon ovoga je API
// za taj IP/partnera ogranicen do isteka prozora — zato se NE pokrece na
// produkciji dok partneri rade.

const http = require("http");
const https = require("https");

const OSNOVNA = process.argv[2] || "http://localhost:6040";
const u = new URL(OSNOVNA);
const klijent = u.protocol === "https:" ? https : http;

const zahtjev = (putanja, { method = "GET", body = null, token = null } = {}) =>
    new Promise((resolve) => {
        const podaci = body ? JSON.stringify(body) : null;
        const zaglavlja = {};
        if (podaci) {
            zaglavlja["Content-Type"] = "application/json";
            zaglavlja["Content-Length"] = Buffer.byteLength(podaci);
        }
        if (token) zaglavlja.Authorization = `Bearer ${token}`;
        const req = klijent.request(
            { host: u.hostname, port: u.port, path: putanja, method, headers: zaglavlja, timeout: 15000 },
            (res) => {
                res.resume();
                res.on("end", () => resolve({
                    status: res.statusCode,
                    // Standardna zaglavlja limitера — po njima se vidi koliko je ostalo.
                    limit: res.headers["ratelimit-limit"],
                    ostalo: res.headers["ratelimit-remaining"],
                }));
            },
        );
        req.on("timeout", () => { req.destroy(); resolve({ status: 0, greska: "timeout" }); });
        req.on("error", (e) => resolve({ status: 0, greska: e.message }));
        if (podaci) req.write(podaci);
        req.end();
    });

// Salje redom dok ne dobije 429 ili dok ne potrosi gornju granicu pokusaja.
//
// Ne broji se od nule: prozor je zajednicki svemu sto je isto tijelo poslalo u
// toj minuti (npr. prethodni prolaz Postman kolekcije), pa bi ocekivanje "429 na
// N+1. zahtjevu" znalo promasiti bez ikakvog kvara. Zato se gleda ono sto
// posluzitelj sam javlja u `RateLimit-Remaining`: odbijenica mora doci tocno kad
// preostalih nema.
const dokNeOgranici = async (naziv, ocekivano, posalji) => {
    const najvise = ocekivano + 15;
    let poslano = 0;
    let zadnjiLimit = null;
    let ostaloPrijeOdbijanja = null;
    for (let i = 1; i <= najvise; i += 1) {
        const r = await posalji();
        if (r.limit) zadnjiLimit = r.limit;
        if (r.status === 0) {
            console.log(`PAO   ${naziv}: ${r.greska}`);
            return false;
        }
        if (r.status === 429) {
            const uredno = ostaloPrijeOdbijanja === "0" || ostaloPrijeOdbijanja === null;
            console.log(
                `${uredno ? "OK   " : "?    "} ${naziv}: odbijeno nakon ${poslano} propustenih` +
                (zadnjiLimit ? ` | granica ${zadnjiLimit}/min` : "") +
                (uredno ? "" : ` | zadnji RateLimit-Remaining bio ${ostaloPrijeOdbijanja}, ocekivano 0`),
            );
            return true;
        }
        poslano += 1;
        ostaloPrijeOdbijanja = r.ostalo ?? null;
    }
    console.log(`PAO   ${naziv}: ni nakon ${najvise} zahtjeva nema 429 (limit se ne primjenjuje?)`);
    return false;
};

(async () => {
    console.log("");
    console.log(`Provjera ogranicenja ucestalosti — ${OSNOVNA}`);
    console.log("Nakon ovoga je API za ovaj IP ogranicen do isteka minute.");
    console.log("");

    let sve = true;

    // 1) Prijava — 10/min po IP-u. Namjerno krivi OTP: ne treba nam token, a i
    //    tako se test ponasa kao pokusaj pogadanja, protiv cega limiter i stoji.
    sve = await dokNeOgranici("prijava (10/min po IP-u)", 10, () =>
        zahtjev("/auth/api_sales_login", { method: "POST", body: { tid: "NEPOSTOJECI", otp: "krivi" } })) && sve;

    // 2) Javna dokumentacija — 30/min po IP-u.
    sve = await dokNeOgranici("dokumentacija (30/min po IP-u)", 30, () =>
        zahtjev("/documentation")) && sve;

    // 3) Zasticene rute — 120/min po partneru. Bez ispravnog tokena limiter pada
    //    na IP, sto je i dalje valjana provjera granice, ali se onda ne mjeri
    //    ono sto nas zanima. Zato se salje token ako je predan kroz okolinu.
    const token = process.env.API_TOKEN || "";
    if (!token) {
        console.log("?     zasticene rute: preskoceno — postavi API_TOKEN (dobiven prijavom) pa ponovi");
    } else {
        sve = await dokNeOgranici("zasticene rute (120/min po partneru)", 120, () =>
            zahtjev("/harbors", { token })) && sve;
    }

    console.log("");
    console.log(sve ? "Ogranicenja rade." : "Nesto ne odgovara ocekivanjima — vidi gore.");
    process.exit(sve ? 0 : 1);
})();
