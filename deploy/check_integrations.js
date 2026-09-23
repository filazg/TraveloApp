#!/usr/bin/env node
// Provjera vanjskih veza — jedan prolaz kroz sve integracije.
//
//   node deploy/check_integrations.js
//
// Zove SAMO lokalne servise (localhost), a oni dalje svoje vanjske sustave.
// Nista se ne salje ni ne knjizi: sve su provjere citanje ili "test veze" koje
// su za to i napravljene. Zato se smije pokrenuti i na produkciji.
//
// Zasto ovako a ne rucno: kad zapne, pitanje je uvijek isto — je li kriva
// konfiguracija, okolina, mreza ili druga strana. Provjere su posložene tako da
// odgovor bude vidljiv iz same poruke.

const http = require("http");

const PORTOVI = {
    control: 5000,
    backoffice: 7010,
    boat: 7020,
    transactions: 7030,
    akd: 7070,
};

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
                    resolve({ status: res.statusCode, json, tekst: s.slice(0, 300) });
                });
            },
        );
        req.on("timeout", () => { req.destroy(); resolve({ status: 0, greska: `timeout ${timeout} ms` }); });
        req.on("error", (e) => resolve({ status: 0, greska: e.message }));
        if (podaci) req.write(podaci);
        req.end();
    });

const OK = "OK   ";
const PAO = "PAO  ";
const UPOZ = "?    ";

// Svaka provjera vraca { oznaka, opis } — opis je ono sto pise u retku ishoda.
const provjere = [
    {
        naziv: "control-service",
        opis: "izvor konfiguracije za sve ostale",
        async izvrsi() {
            const r = await zovi(PORTOVI.control, "/integrations_config");
            if (r.status !== 200) return { oznaka: PAO, opis: r.greska || `status ${r.status}` };
            const cfg = r.json?.data || {};
            const sekcije = Object.keys(cfg).filter((k) => typeof cfg[k] === "object");
            // Tajne se ne ispisuju — samo je li polje popunjeno.
            const tajne = [
                ["seyfor.password", cfg.seyfor?.password],
                ["yescor.client_secret", cfg.yescor?.client_secret],
                ["yescor.app_secret", cfg.yescor?.app_secret],
                ["sudreg.client_secret", cfg.sudreg?.client_secret],
            ];
            const prazne = tajne.filter(([, v]) => !v).map(([k]) => k);
            return {
                oznaka: prazne.length ? UPOZ : OK,
                opis: `sekcije: ${sekcije.join(", ")}` + (prazne.length ? ` | prazno: ${prazne.join(", ")}` : ""),
            };
        },
    },
    {
        naziv: "SAOP (Seyfor iCenter)",
        opis: "sifarnici analitike — citanje",
        async izvrsi() {
            const r = await zovi(PORTOVI.backoffice, "/seyfor_codebook?kind=cost_units");
            if (r.status === 200) {
                const n = (r.json?.data?.items || []).length;
                return { oznaka: n ? OK : UPOZ, opis: `${n} nositelja troska` };
            }
            return { oznaka: PAO, opis: r.json?.data?.message || r.greska || `status ${r.status}` };
        },
    },
    {
        naziv: "YesCor (F2 e-racun)",
        opis: "tenant / registracija dokumenata",
        async izvrsi() {
            const r = await zovi(PORTOVI.transactions, "/yescor_health");
            if (r.status === 200) {
                const d = r.json?.data || r.json || {};
                const okolina = d.environment || d.env || "";
                return { oznaka: OK, opis: `odgovara${okolina ? ` (${okolina})` : ""}` };
            }
            return { oznaka: PAO, opis: r.json?.message || r.json?.error || r.greska || `status ${r.status}` };
        },
    },
    {
        naziv: "AKD SEOP",
        opis: "mTLS veza prema PlovKarte",
        async izvrsi() {
            const r = await zovi(PORTOVI.akd, "/seop/test-veze", { method: "POST", body: {} });
            const d = r.json?.data || r.json || {};
            if (r.status === 200 && (d.ok === true || d.uspjeh === true)) {
                return { oznaka: OK, opis: d.poruka || d.message || "veza radi" };
            }
            return { oznaka: PAO, opis: d.poruka || d.message || r.greska || `status ${r.status}` };
        },
    },
    {
        naziv: "AKD katalog prava",
        opis: "sifarnik prava + upisani popusti",
        async izvrsi() {
            const r = await zovi(PORTOVI.akd, "/povlastica/katalog");
            if (r.status !== 200) return { oznaka: PAO, opis: r.greska || `status ${r.status}` };
            const prava = (r.json?.data?.rights || []).length;
            const p = await zovi(PORTOVI.akd, "/povlastica/popusti");
            const popusti = (p.json?.data?.discounts || []).length;
            return { oznaka: prava ? OK : UPOZ, opis: `${prava} prava, ${popusti} upisanih popusta` };
        },
    },
    {
        naziv: "Sudski registar",
        opis: "provjera OIB-a",
        async izvrsi() {
            // OIB same tvrtke — uvijek postoji, pa je ishod provjera veze, ne podatka.
            const t = await zovi(PORTOVI.control, "/integrations_config");
            const oib = t.json?.data?.tenant?.oib || "";
            if (!oib) return { oznaka: UPOZ, opis: "nema tenant.oib u konfiguraciji" };
            const r = await zovi(PORTOVI.backoffice, `/sudreg?oib=${encodeURIComponent(oib)}`, { timeout: 40000 });
            if (r.status === 200) return { oznaka: OK, opis: `odgovara za OIB ${oib}` };
            return { oznaka: PAO, opis: r.json?.data?.message || r.json?.error || r.greska || `status ${r.status}` };
        },
    },
    {
        naziv: "RabbitMQ",
        opis: "objava promjena prema ostalim servisima",
        async izvrsi() {
            const r = await zovi(PORTOVI.backoffice, "/health");
            if (r.status === 0) return { oznaka: PAO, opis: r.greska };
            // Backoffice nema zaseban status brokera; sam publisher javlja u log.
            return { oznaka: UPOZ, opis: "nema zasebne provjere — vidi `pm2 logs travelo-backoffice-service | grep -i broker`" };
        },
    },
    {
        naziv: "Resend (e-posta)",
        opis: "kljuc u okolini",
        async izvrsi() {
            // Kljuc drze servisi u okolini, ne control. Slanje probne poruke se
            // namjerno NE radi — provjerava se samo je li kljuc postavljen.
            const ima = !!process.env.RESEND_API_KEY;
            return {
                oznaka: ima ? OK : UPOZ,
                opis: ima ? "RESEND_API_KEY postavljen u ovoj ljusci" : "RESEND_API_KEY nije u ovoj ljusci (provjeri pm2 env servisa)",
            };
        },
    },
];

(async () => {
    console.log("");
    console.log("Provjera vanjskih veza — samo citanje, nista se ne salje.");
    console.log("");

    // Provjere idu USPOREDNO. Blokirana veza ceka do isteka timeouta, pa bi
    // redom trajalo koliko i zbroj cekanja — ovako traje koliko najsporija.
    const ishodi = await Promise.all(provjere.map(async (p) => {
        const t0 = Date.now();
        try {
            const r = await p.izvrsi();
            return { p, ...r, ms: Date.now() - t0 };
        } catch (e) {
            return { p, oznaka: PAO, opis: e?.message || String(e), ms: Date.now() - t0 };
        }
    }));

    let palo = 0;
    for (const i of ishodi) {
        if (i.oznaka === PAO) palo += 1;
        const trajanje = i.ms >= 1000 ? `${(i.ms / 1000).toFixed(1)}s` : `${i.ms}ms`;
        console.log(`${i.oznaka} ${i.p.naziv.padEnd(22)} ${i.opis}`);
        console.log(`      ${i.p.opis}  ·  ${trajanje}`);
    }
    console.log("");
    console.log(palo ? `Palo provjera: ${palo}` : "Sve veze rade.");
    process.exit(palo ? 1 : 0);
})();
