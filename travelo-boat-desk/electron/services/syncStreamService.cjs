const fs = require("fs");
const path = require("path");
const https = require("https");
const axios = require("axios");
const { app, BrowserWindow } = require("electron");
const { pairingDataModel } = require("../db/models/Pairing.cjs");
const { systemSettingsDataModel } = require("../db/models/Settings.cjs");
const { salesRoutesDataModel } = require("../db/models/TransportData.cjs");
const { syncTransportDataService } = require("./backendDataService.cjs");

// Poslužitelj javlja blagajni čim se nešto promijeni.
//
// Blagajna radi offline i plovidbeni red povlači sama, pa otkazan ili pomaknut
// polazak ne vidi dok ga netko ručno ne osvježi — do tada ga i dalje prodaje.
// Ovdje se drži otvorena veza prema kanalu; kad stigne poruka da se promijenio
// plovidbeni red, podaci se povuku tiho, bez prekrivanja zaslona i bez pitanja.
//
// Namjerno bez vlastitog brojača vremena: veza sama javlja, a kad pukne, ovdje
// se čeka i pokušava ponovno.
const RAZMAK_PONOVNOG_SPAJANJA_MS = 15 * 1000;

// U instaliranoj aplikaciji konzola glavnog procesa nigdje se ne vidi, pa se
// javljanja upisuju u istu datoteku u koju pise i dizanje.
const zapisi = (...dijelovi) => {
    const red = dijelovi.map((d) => (typeof d === "string" ? d : JSON.stringify(d))).join(" ");
    console.log(red);
    try {
        fs.appendFileSync(path.join(app.getPath("userData"), "startup.log"), `${new Date().toISOString()} ${red}
`);
    } catch (e) { /* zapis nije bitan koliko i rad */ }
};

let veza = null;
let zaustavljen = false;
let zadnjeStanje = null;
let strazar = null;
let ponovnoZakazano = null;

// Koliko se ceka na bilo kakav znak zivota prije nego se veza proglasi mrtvom.
// Posluzitelj salje otkucaj svakih 20 s, pa je tisina duza od minute pouzdan
// znak da veze vise nema — a to se ne vidi uvijek kao greska: kad posluzitelj
// ode, tok zna zavrsiti tiho, bez 'end' i bez 'error'.
const TISINA_MS = 60 * 1000;

const javiProzorima = (poruka) => {
    for (const w of BrowserWindow.getAllWindows()) {
        try { w.webContents.send("app:dataRefreshed", poruka); } catch (e) { /* prozor se zatvara */ }
    }
};

// Sto se tocno promijenilo saznaje se usporedbom: posluzitelj javlja samo da se
// plovidbeni red promijenio, a blagajniku treba pisati koji je polazak otkazan
// ili vracen. Zato se stanje snimi prije osvjezavanja pa usporedi s novim.
const snimiPolaske = async () => {
    const redci = await salesRoutesDataModel.findAll({
        attributes: ["uuid", "departure_date", "departure_time", "actual_departure",
            "departure_harbor_name", "arrival_harbor_name", "line_name"],
    });
    const karta = new Map();
    for (const r of redci) {
        const v = r.dataValues || r;
        // Jedan polazak ima vise etapa (luka do luke); za obavijest je dovoljna
        // jedna po polasku, pa se pamti po vremenu i liniji.
        const kljuc = `${v.departure_date} ${v.departure_time} ${v.line_name}`;
        if (!karta.has(kljuc)) karta.set(kljuc, v);
    }
    return karta;
};

const opisPolaska = (v) => {
    const relacija = [v.departure_harbor_name, v.arrival_harbor_name].filter(Boolean).join(" – ");
    return `${v.departure_date} ${v.departure_time}${v.line_name ? ` · ${v.line_name}` : ""}${relacija ? ` (${relacija})` : ""}`;
};

const usporediPolaske = (prije, poslije) => {
    const otkazani = [];
    const vraceni = [];
    const pomaknuti = [];
    for (const [kljuc, v] of prije) {
        if (!poslije.has(kljuc)) otkazani.push(opisPolaska(v));
        else {
            const novi = poslije.get(kljuc);
            if ((novi.actual_departure || "") !== (v.actual_departure || "")) {
                pomaknuti.push(`${opisPolaska(v)} → ${novi.actual_departure}`);
            }
        }
    }
    for (const [kljuc, v] of poslije) {
        if (!prije.has(kljuc)) vraceni.push(opisPolaska(v));
    }
    return { otkazani, vraceni, pomaknuti };
};

const obradiSignale = async (signali) => {
    const prije = zadnjeStanje;
    zadnjeStanje = signali;
    // Prvo stanje je samo polazna točka — bez ovoga bi se pri svakom spajanju
    // povlačio cijeli plovidbeni red.
    if (!prije) return;
    if (Number(signali.transport || 0) === Number(prije.transport || 0)) return;

    try {
        const prijePolasci = await snimiPolaske();
        await syncTransportDataService();
        const promjene = usporediPolaske(prijePolasci, await snimiPolaske());
        javiProzorima({ kind: "transport", promjene });
        const koliko = promjene.otkazani.length + promjene.vraceni.length + promjene.pomaknuti.length;
        zapisi(`plovidbeni red osvjezen po javljanju posluzitelja (promjena: ${koliko})`);
    } catch (e) {
        // Uređaj ostaje na starim podacima; sljedeće javljanje ili ručno
        // osvježavanje će ga popraviti.
        zapisi("osvjezavanje po javljanju nije uspjelo:", e?.message || e);
    }
};

// Poruke stižu u obliku "event: signals\ndata: {...}\n\n"; ovdje se slaže red po
// red jer odgovor dolazi u komadima kako mreža stigne.
const napraviCitac = () => {
    let spremnik = "";
    return (komad) => {
        spremnik += komad.toString("utf8");
        const poruke = spremnik.split("\n\n");
        spremnik = poruke.pop();
        const izlaz = [];
        for (const poruka of poruke) {
            const redci = poruka.split("\n");
            const dogadaj = redci.find((r) => r.startsWith("event:"))?.slice(6).trim();
            const podaci = redci.find((r) => r.startsWith("data:"))?.slice(5).trim();
            if (dogadaj === "signals" && podaci) {
                try { izlaz.push(JSON.parse(podaci)); } catch (e) { /* nepotpuna poruka */ }
            }
        }
        return izlaz;
    };
};

const ugasiStrazara = () => {
    if (strazar) { clearTimeout(strazar); strazar = null; }
};

const nakalemiStrazara = () => {
    ugasiStrazara();
    strazar = setTimeout(() => {
        zapisi("posluzitelj se ne javlja vise od minute, veza se otvara ponovno");
        try { veza?.destroy(); } catch (e) { /* vec zatvoreno */ }
        veza = null;
        zakaziPonovno();
    }, TISINA_MS);
    strazar.unref?.();
};

const spoji = async () => {
    if (zaustavljen || veza) return;
    try {
        const postavke = await systemSettingsDataModel.findOne();
        const uparivanje = await pairingDataModel.findOne();
        if (!postavke?.backend_url || !uparivanje?.token) {
            // Blagajna još nije uparena; pokušaj ponovno kasnije.
            return zakaziPonovno();
        }

        const odgovor = await axios.get(postavke.backend_url + "/terminals/terminal/sync_stream", {
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            headers: { authorization: "Bearer " + uparivanje.token, accept: "text/event-stream" },
            responseType: "stream",
            // Veza je namjerno bez isteka: drži se otvorena dok je ima.
            timeout: 0,
        });

        veza = odgovor.data;
        zapisi("otvorena veza prema posluzitelju za javljanje promjena");
        const citaj = napraviCitac();

        nakalemiStrazara();

        veza.on("data", (komad) => {
            // Svaki znak zivota, i obican otkucaj, pomice strazara.
            nakalemiStrazara();
            for (const signali of citaj(komad)) obradiSignale(signali).catch(() => {});
        });
        // Kad posluzitelj ode, tok zna zavrsiti i bez greske — zato se slusaju
        // svi zavrsetci, inace bi blagajna ostala bez javljanja do restarta.
        const prekinuto = (razlog) => {
            ugasiStrazara();
            if (!veza) return;
            veza = null;
            zapisi("veza prema posluzitelju prekinuta:", razlog);
            zakaziPonovno();
        };
        veza.on("end", () => prekinuto("kraj toka"));
        veza.on("close", () => prekinuto("zatvoreno"));
        veza.on("aborted", () => prekinuto("prekinuto"));
        veza.on("error", (e) => prekinuto(e?.message || String(e)));
    } catch (e) {
        zapisi("spajanje na javljanje promjena nije uspjelo:", e?.message || e);
        zakaziPonovno();
    }
};

const zakaziPonovno = () => {
    if (zaustavljen || ponovnoZakazano) return;
    // Zadnje stanje se NE zaboravlja: ako je veza pukla, a u međuvremenu je
    // polazak otkazan, prvo stanje nove veze mora se usporediti sa zatečenim —
    // inače bi se promjena u prekidu tiho izgubila.
    // Samo jedan zakazani povratak: strazar i prekid znaju okinuti jedan za
    // drugim, pa bi se inace otvorile dvije veze prema posluzitelju.
    ponovnoZakazano = setTimeout(() => {
        ponovnoZakazano = null;
        spoji().catch(() => {});
    }, RAZMAK_PONOVNOG_SPAJANJA_MS);
    ponovnoZakazano.unref?.();
};

const startSyncStreamService = () => {
    zaustavljen = false;
    spoji().catch(() => {});
};

const stopSyncStreamService = () => {
    zaustavljen = true;
    ugasiStrazara();
    if (ponovnoZakazano) { clearTimeout(ponovnoZakazano); ponovnoZakazano = null; }
    try { veza?.destroy(); } catch (e) { /* vec zatvoreno */ }
    veza = null;
};

module.exports = { startSyncStreamService, stopSyncStreamService };
