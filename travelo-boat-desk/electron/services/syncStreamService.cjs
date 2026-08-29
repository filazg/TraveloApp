const fs = require("fs");
const path = require("path");
const https = require("https");
const axios = require("axios");
const { app, BrowserWindow } = require("electron");
const { pairingDataModel } = require("../db/models/Pairing.cjs");
const { systemSettingsDataModel } = require("../db/models/Settings.cjs");
const { syncTransportDataService } = require("./backendDataService.cjs");

// Poslužitelj javlja blagajni čim se nešto promijeni.
//
// Blagajna radi offline i vozni red povlači sama, pa otkazan ili pomaknut
// polazak ne vidi dok ga netko ručno ne osvježi — do tada ga i dalje prodaje.
// Ovdje se drži otvorena veza prema kanalu; kad stigne poruka da se promijenio
// vozni red, podaci se povuku tiho, bez prekrivanja zaslona i bez pitanja.
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

const javiProzorima = (poruka) => {
    for (const w of BrowserWindow.getAllWindows()) {
        try { w.webContents.send("app:dataRefreshed", poruka); } catch (e) { /* prozor se zatvara */ }
    }
};

const obradiSignale = async (signali) => {
    const prije = zadnjeStanje;
    zadnjeStanje = signali;
    // Prvo stanje je samo polazna točka — bez ovoga bi se pri svakom spajanju
    // povlačio cijeli vozni red.
    if (!prije) return;
    if (Number(signali.transport || 0) === Number(prije.transport || 0)) return;

    try {
        await syncTransportDataService();
        javiProzorima({ kind: "transport" });
        zapisi("vozni red osvjezen po javljanju posluzitelja");
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

const spoji = async () => {
    if (zaustavljen) return;
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

        veza.on("data", (komad) => {
            for (const signali of citaj(komad)) obradiSignale(signali).catch(() => {});
        });
        veza.on("end", () => { veza = null; zakaziPonovno(); });
        veza.on("error", (e) => {
            zapisi("veza prema posluzitelju pukla:", e?.message || e);
            veza = null;
            zakaziPonovno();
        });
    } catch (e) {
        zapisi("spajanje na javljanje promjena nije uspjelo:", e?.message || e);
        zakaziPonovno();
    }
};

const zakaziPonovno = () => {
    if (zaustavljen) return;
    // Zadnje stanje se NE zaboravlja: ako je veza pukla, a u međuvremenu je
    // polazak otkazan, prvo stanje nove veze mora se usporediti sa zatečenim —
    // inače bi se promjena u prekidu tiho izgubila.
    setTimeout(() => { spoji().catch(() => {}) }, RAZMAK_PONOVNOG_SPAJANJA_MS).unref?.();
};

const startSyncStreamService = () => {
    zaustavljen = false;
    spoji().catch(() => {});
};

const stopSyncStreamService = () => {
    zaustavljen = true;
    try { veza?.destroy(); } catch (e) { /* vec zatvoreno */ }
    veza = null;
};

module.exports = { startSyncStreamService, stopSyncStreamService };
