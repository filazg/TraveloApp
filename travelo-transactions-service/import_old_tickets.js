// Uvoz karata iz starog sustava (Aktiva), da se mogu validirati kod nas.
//
// Karte su prodane u starom sustavu; kod nas se NE prodaju i NE storniraju —
// samo se validiraju, i to tako da se dvostruka validacija vidi. Zato se
// uvoze kao karte s oznakom podrijetla "OLD", bez cijene i bez racuna: promet
// je ostao ondje gdje je i naplacen.
//
// Stare karte nose crtični kod broja karte, pa se taj broj upisuje u
// `ticket_code` i u `ticket_qr` — skener ocita upravo njega i validacija ga
// nade. `ticket_uuid` je nas, jer je kljuc u nasoj bazi.
//
// Karta se veze na nas polazak po datumu putovanja, vremenu polaska i smjeru.
// Bez polaska u nasem plovidbenom redu karta se ne uvozi — takvu se ne bi imalo
// gdje validirati.
//
// Pokretanje:
//   node import_old_tickets.js "<putanja.xlsx>" [od=YYYY-MM-DD] [do=YYYY-MM-DD] [--stvarno]
// Bez `--stvarno` samo ispisuje sto bi napravio.
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const { Sequelize, QueryTypes, Op } = require("sequelize");
const XLSX = require(path.join(__dirname, "..", "travelo-portal", "node_modules", "xlsx-js-style"));
const {
    syncCoreServiceConfigData,
    syncDatabaseConfigData,
    getDatabaseConfigData,
    getCoreServiceConfigData,
} = require("./controllers/configSyncController");

const OZNAKA = "OLD";
// Naziv starog sustava; stoji na karti umjesto imena putnika.
const PUTNIK = "Activa";

// Nazivi luka iz Aktive prema nasim sifrma. Aktiva mjestimicno pise otok, a mi
// luku ("BRAČ (MILNA)" je nasa Milna), pa se ne moze usporedivati po nazivu.
const LUKE = {
    SPLIT: "HR479",
    "HVAR (MAIN PIER)": "HR364",
    HVAR: "HR364",
    "VIRA (HVAR)": "HR412",
    VIRA: "HR412",
    "BRAČ (MILNA)": "HR391",
    MILNA: "HR391",
    VIS: "HR368",
    KORČULA: "HR491",
    "POMENA (NP MLJET)": "HR543",
    POMENA: "HR543",
    // Dubrovacka luka je kod nas Gruz.
    DUBROVNIK: "HR489",
    GRUŽ: "HR489",
    PULA: "HR001",
    ZADAR: "HR201",
    SILBA: "HR206",
    "MALI LOŠINJ": "HR058",
    SUSAK: "HR103",
    UNIJE: "HR107",
    ILOVIK: "HR076",
};

// Vrste karata iz Aktive. Cijena se ne prenosi, pa je vazan samo naziv koji
// djelatnik vidi pri validaciji.
const VRSTE = {
    NOR: "Redovna",
    OT: "Otočani",
    BES: "Besplatna",
    POV: "Povlaštena",
    POV50: "Povlaštena 50%",
    KAV: "Povlaštena",
};

const uDatum = (v) => {
    if (typeof v !== "number") return null;
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
};
const dmy = (d) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
const iso = (d) => d.toISOString().slice(0, 10);

const procitajExcel = (putanja) => {
    const wb = XLSX.readFile(putanja);
    const redci = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
    const karte = [];
    let danProdaje = null;
    for (let i = 0; i < redci.length; i++) {
        const r = redci[i];
        // Datum prodaje stoji samo na retku dnevnog zbroja i vrijedi za retke ispod.
        if (typeof r[0] === "number") { danProdaje = uDatum(r[0]); continue; }
        if (!r[5] || !r[14]) continue;
        const [od, doo] = String(r[16] || "").split(" - ").map((x) => x.trim());
        karte.push({
            ticket_code: String(r[5]).trim(),
            racun: String(r[2] || "").trim(),
            prodano: danProdaje,
            zaDan: uDatum(r[14]),
            vrijeme: String(r[15] || "").trim(),
            odLuka: LUKE[String(od || "").toUpperCase()] || null,
            doLuka: LUKE[String(doo || "").toUpperCase()] || null,
            relacija: String(r[16] || "").trim(),
            vrsta: String(r[17] || "").trim(),
        });
    }
    return karte;
};

(async () => {
    const [, , putanjaArg, odArg, doArg] = process.argv;
    const stvarno = process.argv.includes("--stvarno");
    if (!putanjaArg) {
        console.log('Uporaba: node import_old_tickets.js "<putanja.xlsx>" [od] [do] [--stvarno]');
        process.exit(1);
    }
    const danas = new Date();
    const od = odArg && /^\d{4}-\d{2}-\d{2}$/.test(odArg) ? new Date(`${odArg}T00:00:00Z`) : new Date(Date.UTC(danas.getFullYear(), danas.getMonth(), danas.getDate()));
    const doo = doArg && /^\d{4}-\d{2}-\d{2}$/.test(doArg) ? new Date(`${doArg}T00:00:00Z`) : new Date(od.getTime() + 8 * 86400000);

    await syncCoreServiceConfigData();
    await syncDatabaseConfigData();
    const cfg = await getDatabaseConfigData();
    if (!cfg?.db_pass) throw new Error("control-service nije vratio lozinku baze");
    const core = await getCoreServiceConfigData();
    const salesUrl = core?.services?.sales?.url;
    if (!salesUrl) throw new Error("nema adrese sales-servisa");

    const karte = procitajExcel(putanjaArg);
    const uRasponu = karte.filter((k) => k.zaDan && k.zaDan >= od && k.zaDan <= doo);
    console.log(`datoteka: ${karte.length} karata | razdoblje putovanja ${iso(od)} – ${iso(doo)}: ${uRasponu.length}`);

    const rute = (await axios.get(`${salesUrl}/routes`, { timeout: 20000 })).data?.data?.routes || [];
    const poKljucu = new Map();
    for (const r of rute) {
        poKljucu.set(`${r.departure_date}|${r.departure_time}|${r.departure_harbor_id}|${r.arrival_harbor_id}`, r);
    }

    const sequelize = new Sequelize(cfg.db_name, cfg.db_username, cfg.db_pass, {
        host: cfg.db_host,
        port: cfg.db_port,
        dialect: "postgres",
        dialectOptions: { decimalNumbers: true, ssl: { require: true, rejectUnauthorized: false } },
        logging: false,
    });

    try {
        await sequelize.authenticate();

        // Ponovno pokretanje ne smije stvoriti duplikat: kljuc je oznaka karte.
        const postojece = new Set(
            (await sequelize.query(
                `SELECT ticket_code FROM tickets WHERE origin = :oznaka`,
                { replacements: { oznaka: OZNAKA }, type: QueryTypes.SELECT }
            )).map((r) => r.ticket_code)
        );

        const zaUpis = [];
        const preskoceno = new Map();
        for (const k of uRasponu) {
            if (postojece.has(k.ticket_code)) { preskoceno.set("vec uvezena", (preskoceno.get("vec uvezena") || 0) + 1); continue; }
            if (!k.odLuka || !k.doLuka) { preskoceno.set(`nepoznata luka: ${k.relacija}`, (preskoceno.get(`nepoznata luka: ${k.relacija}`) || 0) + 1); continue; }
            const ruta = poKljucu.get(`${dmy(k.zaDan)}|${k.vrijeme}|${k.odLuka}|${k.doLuka}`);
            if (!ruta) {
                const razlog = `nema polaska ${dmy(k.zaDan)} ${k.vrijeme} ${k.odLuka}->${k.doLuka}`;
                preskoceno.set(razlog, (preskoceno.get(razlog) || 0) + 1);
                continue;
            }
            const ticket_uuid = crypto.randomUUID();
            zaUpis.push({
                ticket_uuid,
                ticket_code: k.ticket_code,
                // Stara karta nosi crtični kod broja karte — skener ocita njega.
                ticket_qr: k.ticket_code,
                order_uuid: null,
                order_number: k.racun || null,
                ticket_type_name: VRSTE[k.vrsta] || k.vrsta || "Redovna",
                ticket_type_uuid: null,
                // Promet je naplacen u starom sustavu i ovamo se ne prenosi.
                single_price: 0,
                is_active: true,
                is_canceled: false,
                route_uuid: ruta.uuid,
                departure_planed: ruta.actual_departure || ruta.departure,
                departure: ruta.actual_departure || ruta.departure,
                line_code: ruta.line_code,
                line_name: ruta.line_name,
                departure_harbor_id: ruta.departure_harbor_id,
                departure_harbor_name: ruta.departure_harbor_name,
                arrival_planed: ruta.actual_arrival || ruta.arrival,
                arrival: ruta.actual_arrival || ruta.arrival,
                arrival_harbor_id: ruta.arrival_harbor_id,
                arrival_harbor_name: ruta.arrival_harbor_name,
                deactivate: false,
                status: "created",
                origin: OZNAKA,
                // Stari sustav ne salje ime putnika. Umjesto prazne rubrike
                // stoji njegov naziv, pa djelatnik pri validaciji odmah vidi
                // odakle karta dolazi.
                passanger_name: PUTNIK,
                order_note: `Preuzeto iz starog sustava (racun ${k.racun || "—"})`,
            });
        }

        console.log(`za uvoz: ${zaUpis.length}`);
        if (preskoceno.size) {
            console.log("preskoceno:");
            for (const [razlog, n] of [...preskoceno.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
                console.log(`  ${n} × ${razlog}`);
            }
        }

        const poDanu = new Map();
        for (const t of zaUpis) {
            const d = String(t.departure_planed || "").slice(0, 10);
            poDanu.set(d, (poDanu.get(d) || 0) + 1);
        }
        console.log("po danu polaska:");
        // Datum polaska je tekst "DD.MM.YYYY." — abecedno bi se poredao krivo.
        const kronoloski = (d) => d.split(".").slice(0, 3).reverse().join("");
        for (const [d, n] of [...poDanu.entries()].sort((a, b) => kronoloski(a[0]).localeCompare(kronoloski(b[0])))) {
            console.log(`  ${d}: ${n}`);
        }

        if (!stvarno) {
            console.log("\nproba — nista nije upisano. Dodaj --stvarno za uvoz.");
            return;
        }

        const STUPCI = Object.keys(zaUpis[0] || {});
        for (let i = 0; i < zaUpis.length; i += 200) {
            const dio = zaUpis.slice(i, i + 200);
            const zamjene = {};
            const vrijednosti = dio.map((t, n) => {
                const polja = STUPCI.map((s) => {
                    zamjene[`${s}_${n}`] = t[s];
                    return `:${s}_${n}`;
                });
                return `(${polja.join(", ")}, NOW(), NOW())`;
            });
            await sequelize.query(
                `INSERT INTO tickets (${STUPCI.map((s) => `"${s}"`).join(", ")}, "createdAt", "updatedAt")
                 VALUES ${vrijednosti.join(", ")}`,
                { replacements: zamjene }
            );
        }
        const [stanje] = await sequelize.query(
            `SELECT COUNT(*)::int AS n FROM tickets WHERE origin = :oznaka`,
            { replacements: { oznaka: OZNAKA }, type: QueryTypes.SELECT }
        );
        console.log(`\nupisano: ${zaUpis.length} | ukupno karata s oznakom ${OZNAKA}: ${stanje.n}`);
    } finally {
        await sequelize.close();
    }
})().catch((e) => {
    console.error("uvoz pukao:", e.message);
    process.exit(1);
});
