// electron/services/updateService.cjs
//
// Automatsko ažuriranje deska preko electron-updater (generic feed na VM-u —
// vidi `publish` u package.json). Pravilo koje čuva rad blagajnika:
//
//   Preuzimanje ide u pozadini čim se nađe nova verzija, ali INSTALACIJA i
//   ponovno pokretanje događaju se ISKLJUČIVO dok je aplikacija "idle" — na
//   prijavnom ili ekranu uparivanja (stage !== 'sales'). Tako se nikad ne
//   prekida prodaja: ako operater radi, update samo čeka spreman i primijeni
//   se čim se odjavi (ili sutradan na prijavnom ekranu, jer se smjena u 01:00
//   ionako zatvara i vraća na login).
//
// Provjera se pokreće na startu i pri svakom povratku na login (uz throttle),
// pa dugotrajno upaljena instanca ipak pokupi novu verziju.

const { autoUpdater } = require("electron-updater");
const { app, BrowserWindow, ipcMain } = require("electron");

let deps = { logToFile: () => {} };
let idle = false;              // true kad app nije u prodaji (login/pairing)
let pendingDownloaded = false; // nova verzija preuzeta, čeka trenutak za instalaciju
let installing = false;        // spriječi dvostruki quitAndInstall
let lastCheckAt = 0;           // throttle provjera
const MIN_CHECK_INTERVAL_MS = 15 * 60 * 1000;
// Dok app stoji na loginu (idle), ovako često ponovno provjeri feed — da se
// verzija AKTIVIRANA dok app već stoji na prijavnom ekranu pokupi sama, bez
// ručnog restarta.
const IDLE_POLL_MS = 5 * 60 * 1000;

function log(...args) {
  try { deps.logToFile("[update]", ...args); } catch { /* ignore */ }
}

function sendToRenderer(payload) {
  for (const w of BrowserWindow.getAllWindows()) {
    try { w.webContents.send("app:update", payload); } catch { /* ignore */ }
  }
}

// Instaliraj samo kad je sve spremno: verzija preuzeta, app idle i nismo već
// krenuli u instalaciju.
function maybeInstall() {
  if (!pendingDownloaded || !idle || installing) return;
  installing = true;
  log("primjenjujem update (idle) — quitAndInstall");
  sendToRenderer({ phase: "installing" });
  // Kratka odgoda da renderer stigne prikazati poruku prije gašenja prozora.
  setTimeout(() => {
    try {
      // (isSilent=true, isForceRunAfter=true) → tiha NSIS instalacija pa auto
      // pokretanje nove verzije.
      autoUpdater.quitAndInstall(true, true);
    } catch (e) {
      installing = false;
      log("quitAndInstall pao:", e?.message || String(e));
    }
  }, 1200);
}

// Provjera nove verzije uz throttle. force preskače throttle (npr. na startu).
function checkNow(force = false) {
  if (!app.isPackaged) {
    log("preskačem provjeru — app nije packaged (dev)");
    return;
  }
  const now = Date.now();
  if (!force && now - lastCheckAt < MIN_CHECK_INTERVAL_MS) return;
  lastCheckAt = now;
  log("provjera nove verzije…");
  autoUpdater.checkForUpdates().catch((e) => {
    // Feed još ne postoji, VM nedostupan, offline blagajna — normalno, samo
    // zabilježi i pokušaj sljedeći put. Nikad ne ruši aplikaciju.
    log("provjera nije uspjela:", e?.message || String(e));
  });
}

// Renderer javlja trenutni stage; "idle" je sve osim aktivne prodaje.
function setStage(stage) {
  const wasIdle = idle;
  idle = !!stage && stage !== "sales";
  // Povratak na login (izlaz iz prodaje) je prilika i za instalaciju spremnog
  // update-a i za novu provjeru.
  if (idle) {
    maybeInstall();
    if (!wasIdle) checkNow(false);
  }
}

function initAutoUpdate(options = {}) {
  deps = { logToFile: options.logToFile || (() => {}) };

  // Ne preuzimaj automatski prije nego što svjesno pozovemo — želimo prvo
  // javiti rendereru da nova verzija postoji. (Preuzimanje pokrećemo u
  // 'update-available'.) autoInstallOnAppQuit je fallback: ako app normalno
  // izađe s preuzetom verzijom, NSIS se primijeni pri gašenju.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  // Naš logger — electron-updater inače traži electron-log.
  autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };

  autoUpdater.on("checking-for-update", () => sendToRenderer({ phase: "checking" }));

  autoUpdater.on("update-available", (info) => {
    log("dostupna verzija:", info?.version);
    sendToRenderer({ phase: "available", version: info?.version });
    autoUpdater.downloadUpdate().catch((e) => {
      log("preuzimanje nije uspjelo:", e?.message || String(e));
      sendToRenderer({ phase: "error", message: e?.message || String(e) });
    });
  });

  autoUpdater.on("update-not-available", () => sendToRenderer({ phase: "none" }));

  autoUpdater.on("download-progress", (p) => {
    sendToRenderer({ phase: "downloading", percent: Math.round(p?.percent || 0) });
  });

  autoUpdater.on("update-downloaded", (info) => {
    log("verzija preuzeta:", info?.version);
    pendingDownloaded = true;
    sendToRenderer({ phase: "downloaded", version: info?.version });
    // Ako je operater već na loginu, instaliraj odmah; inače čeka odjavu.
    maybeInstall();
  });

  autoUpdater.on("error", (e) => {
    log("greška updatera:", e?.message || String(e));
    sendToRenderer({ phase: "error", message: e?.message || String(e) });
  });

  // Renderer → main: trenutni stage (login/pairing/sales/…).
  ipcMain.on("app:reportStage", (_e, stage) => setStage(stage));

  // Prva provjera nešto nakon starta — baza i prozor su tad spremni, a operater
  // je na prijavnom ekranu (idle), pa je i eventualna instalacija bezbolna.
  setTimeout(() => checkNow(true), 10000);

  // Periodična provjera DOK je app idle (na loginu/uparivanju): pokriva slučaj
  // da app satima stoji na prijavnom ekranu, a verzija se aktivira u međuvremenu
  // — bez ovoga bi je pokupila tek kod ručnog restarta. Ako je već preuzeta ili
  // se instalira, preskačemo. Instalacija svejedno ide samo na idle-u.
  setInterval(() => {
    if (idle && !installing && !pendingDownloaded) checkNow(true);
  }, IDLE_POLL_MS);
}

module.exports = { initAutoUpdate, checkNow, setStage };
