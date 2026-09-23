#!/usr/bin/env node
// Popuna kapaciteta za polaske koji ih nemaju.
//
//   node deploy/backfill_bookings.js                 — pregled, nista se ne mijenja
//   node deploy/backfill_bookings.js --line=658      — pregled za jednu liniju
//   node deploy/backfill_bookings.js --line=658 --izvrsi
//   node deploy/backfill_bookings.js --timetable=<uuid> --izvrsi
//
// Zasto postoji: kapaciteti se ne racunaju u hodu nego stoje kao zapis po
// polasku i etapi, a stvaraju se pri kreiranju plovidbenog reda. Ako taj korak
// za dio polazaka ne prode, blagajna za njih pokazuje 0 slobodnih mjesta iako
// brod nije pun — a otkrije se tek kad netko pokusa prodati kartu.
//
// Bez `--izvrsi` samo ispisuje stanje, pa se smije pokrenuti i na produkciji.
// Uz `--izvrsi` zove `POST /bookings/init`, koji je idempotentan: polazak koji
// vec ima zapise preskace, pa ponovno pokretanje nista ne kvari.

const http = require("http");

const PORTOVI = { boat: 7020, booking: 7060 };

const arg = (ime) => {
    const p = process.argv.find((a) => a.startsWith(`--${ime}=`));
    return p ? p.split("=").slice(1).join("=") : null;
};
const ima = (ime) => process.argv.includes(`--${ime}`);

const zovi = (port, put, { method = "GET", body = null, timeout = 30000 } = {}) =>
    new Promise((resolve) => {
        const podaci = body ? JSON.stringify(body) : null;
        const req = http.request(
            {
                host: "127.0.0.1",
                port,
                path: put,
                method,
                headers: podaci
                    ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(podaci) }
                    : {},
                timeout,
            },
            (res) => {
                let s = "";
                res.on("data", (d) => (s += d));
                res.on("end", () => {
                    let json = null;
                    try { json = JSON.parse(s); } catch { /* nije JSON */ }
                    resolve({ status: res.statusCode, json });
                });
            },
        );
        req.on("timeout", () => { req.destroy(); resolve({ status: 0, greska: `timeout ${timeout} ms` }); });
        req.on("error", (e) => resolve({ status: 0, greska: e.message }));
        if (podaci) req.write(podaci);
        req.end();
    });

// Kanonski polazak voyage-a je onaj s najmanjim redoslijedom luke: pod njim
// booking servis drzi zapise za cijeli voyage. Zato se init zove bas za njega,
// a ne za bilo koju etapu.
const kanonski = (etape) =>
    [...etape].sort((a, b) => Number(a.departure_harbor_order) - Number(b.departure_harbor_order))[0];

(async () => {
    const linija = arg("line");
    const red = arg("timetable");
    const izvrsi = ima("izvrsi");

    console.log("");
    console.log(izvrsi ? "Popuna kapaciteta — UPISUJE." : "Popuna kapaciteta — samo pregled (dodaj --izvrsi za upis).");
    console.log("");

    const dep = await zovi(PORTOVI.boat, "/departures", { timeout: 60000 });
    if (dep.status !== 200) {
        console.log("Polasci se nisu ucitali:", dep.greska || `status ${dep.status}`);
        process.exit(1);
    }
    let polasci = dep.json?.data?.departures || [];
    if (linija) polasci = polasci.filter((d) => String(d.line_code) === String(linija));
    if (red) polasci = polasci.filter((d) => d.timetable_uuid === red);
    if (!polasci.length) {
        console.log("Nema polazaka za zadani uvjet.");
        process.exit(1);
    }

    // Voyage je (plovidbeni red + redni broj); etape istog voyage-a dijele oboje.
    const voyages = new Map();
    for (const d of polasci) {
        const kljuc = `${d.timetable_uuid}|${d.sequence}`;
        if (!voyages.has(kljuc)) voyages.set(kljuc, []);
        voyages.get(kljuc).push(d);
    }

    // Postojeci zapisi se dohvacaju po plovidbenom redu, jednim upitom umjesto
    // po voyage-u — inace bi provjera bila sporija od same popune.
    const redovi = [...new Set(polasci.map((d) => d.timetable_uuid))];
    const imaZapise = new Set();
    for (const tt of redovi) {
        const r = await zovi(PORTOVI.booking, `/bookings?timetable_uuid=${encodeURIComponent(tt)}`, { timeout: 60000 });
        for (const b of (r.json?.data?.bookings || [])) imaZapise.add(`${b.timetable_uuid}|${b.sequence}`);
    }

    const bez = [...voyages.entries()].filter(([kljuc]) => !imaZapise.has(kljuc));

    // Sazetak po liniji — rupa je gotovo uvijek vezana uz jedan plovidbeni red.
    const poLiniji = new Map();
    for (const [kljuc, etape] of voyages) {
        const kod = etape[0].line_code;
        const z = poLiniji.get(kod) || { ukupno: 0, bez: 0, naziv: etape[0].line_name };
        z.ukupno += 1;
        if (!imaZapise.has(kljuc)) z.bez += 1;
        poLiniji.set(kod, z);
    }
    console.log("linija  polazaka  bez kapaciteta");
    for (const [kod, z] of [...poLiniji.entries()].sort((a, b) => b[1].bez - a[1].bez)) {
        const oznaka = z.bez ? "!" : " ";
        console.log(`${oznaka} ${String(kod).padEnd(6)} ${String(z.ukupno).padStart(6)}  ${String(z.bez).padStart(8)}   ${z.naziv || ""}`);
    }
    console.log("");
    console.log(`Ukupno bez kapaciteta: ${bez.length} od ${voyages.size} polazaka.`);

    if (!bez.length) { console.log("Nema sto popuniti."); process.exit(0); }
    if (!izvrsi) {
        console.log("Pokreni isto uz --izvrsi da se popune.");
        process.exit(0);
    }

    // Serije po pet, kao i pri kreiranju reda: booking servis i baza iza njega
    // ne podnesu stotine istovremenih poziva, a upravo je to i napravilo rupu
    // koju sada popunjavamo.
    console.log("");
    let proslo = 0;
    const pali = [];
    for (let i = 0; i < bez.length; i += 5) {
        const serija = bez.slice(i, i + 5);
        await Promise.all(serija.map(async ([kljuc, etape]) => {
            const prvi = kanonski(etape);
            const r = await zovi(PORTOVI.booking, "/bookings/init", {
                method: "POST",
                body: { departure_uuid: prvi.uuid },
                timeout: 30000,
            });
            if (r.status === 200) proslo += 1;
            else pali.push(`${kljuc} (${r.greska || `status ${r.status}`})`);
        }));
        process.stdout.write(`\r  popunjeno ${proslo}/${bez.length}`);
    }
    console.log("");
    console.log("");
    console.log(`Popunjeno: ${proslo} od ${bez.length}.`);
    if (pali.length) {
        console.log(`Nije proslo (${pali.length}):`);
        for (const p of pali.slice(0, 20)) console.log("  ", p);
        if (pali.length > 20) console.log(`   … i jos ${pali.length - 20}`);
    }
    process.exit(pali.length ? 1 : 0);
})();
