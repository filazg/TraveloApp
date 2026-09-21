// electron/main.cjs
const path = require("path");
const fs = require("fs");
const https = require("https");
const axios = require("axios");
const { app, BrowserWindow, ipcMain } = require("electron");
const { sequelize } = require("./db/index.cjs");
const { registerIpcHandlers } = require("./ipc/index.cjs");
const { pairingDataModel } = require("./db/models/Pairing.cjs");
const { systemSettingsDataModel } = require("./db/models/Settings.cjs");
const { syncPendingInvoicesService, syncPendingCopyPrintsService } = require("./services/invoiceDataService.cjs");
const { startSyncStreamService } = require("./services/syncStreamService.cjs");
const { syncPendingShiftsService, autoCloseShiftsService } = require("./services/shiftsDataService.cjs");
const { syncBasicDataService, syncTransportDataService } = require("./services/backendDataService.cjs");
const { initAutoUpdate } = require("./services/updateService.cjs");

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5182";
const DEBUG_PROD = process.env.DEBUG_PROD === "1";

app.disableHardwareAcceleration();
function logToFile(...args) {
  try {
    const p = path.join(app.getPath("userData"), "startup.log");
    const line =
      args
        .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
        .join(" ") + "\n";
    fs.appendFileSync(p, line);
  } catch {
    // ignore
  }
}

process.on("uncaughtException", (e) => {
  logToFile("uncaughtException:", e?.stack || String(e));
});

process.on("unhandledRejection", (e) => {
  logToFile("unhandledRejection:", e?.stack || String(e));
});

function getProdIndexHtmlPath() {
  // main.cjs je u /electron, pa idemo jedan folder gore
  return path.join(__dirname, "..", "renderer", "dist", "index.html");
}

// Najuža širina sadržaja na kojoj prodajni ekran još stane cijel:
//   stupci 445 + 430 + 430 + 213 = 1518, plus 3 razmaka po 16 = 1566
//   + padding glavnog dijela 2×16 = 1598
//   + padding oko cijelog ekrana 2×16 = 1630
// Stupci imaju fiksne širine i ne skupljaju se, a okvir je overflow:hidden, pa
// se ispod te širine stupac Plaćanje odreže s desne strane.
//
// Dodanih 16px je zaliha: na točno 1630 grid je bio širok koliko i stupci u
// pikselu, pa je zaokruživanje znalo prelomiti redak.
const CONTENT_MIN_WIDTH = 1646;

// Od dvoklika do prvog prozora prođe nekoliko sekundi: Electron se digne, pa
// sequelize.sync({alter:true}) prođe kroz sve tablice. Dotad na ekranu nema
// ničega, pa blagajnik ne zna je li aplikacija uopće krenula i klikne ponovno.
// Splash se digne prije baze i zatvara se kad glavni prozor ima što pokazati.
let splashWin = null;

const splashHtml = () => `<!doctype html>
<html lang="hr"><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;overflow:hidden;
    font-family:"Segoe UI",Roboto,Arial,sans-serif;-webkit-user-select:none;}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:16px;background:#F5F2EB;color:#383E42;border:1px solid #E5E0D6;border-radius:14px;}
  .naziv{font-size:30px;font-weight:800;letter-spacing:.5px;color:#175BD0;line-height:1;}
  /* "APP" u tamnoj boji teksta iz teme — bijela bi se na krem podlozi izgubila. */
  .naziv b{color:#383E42;font-weight:800;}
  .verzija{font-size:13px;font-weight:600;color:#5C656B;letter-spacing:.5px;}
  .podnaslov{font-size:14px;color:#5C656B;}
  .traka{width:220px;height:6px;border-radius:3px;background:#E5E0D6;overflow:hidden;margin-top:6px;}
  .traka i{display:block;width:40%;height:100%;border-radius:3px;background:#175BD0;
    animation:klizi 1.1s ease-in-out infinite;}
  @keyframes klizi{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
</style></head><body>
  <div class="naziv">Travelo<b>APP</b></div>
  <div class="verzija">v${app.getVersion()}</div>
  <div class="traka"><i></i></div>
  <div class="podnaslov">Priprema podataka…</div>
</body></html>`;

function createSplash() {
  splashWin = new BrowserWindow({
    width: 420,
    height: 240,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    center: true,
    transparent: true,
    backgroundColor: "#00000000",
    title: "TraveloAPP",
    show: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  // Ugrađen HTML, ne datoteka — splash mora raditi i u devu (Vite još nije
  // spreman) i u instaliranoj verziji, bez ovisnosti o rendereru.
  splashWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(splashHtml()));
  splashWin.on("closed", () => { splashWin = null; });
  return splashWin;
}

function closeSplash() {
  if (splashWin && !splashWin.isDestroyed()) {
    splashWin.close();
  }
  splashWin = null;
}

function createWindow() {
  logToFile("createWindow()");
  const win = new BrowserWindow({
    width: 1700,
    height: 1100,
    minWidth: 1200,
    minHeight: 1100,
    title: "TraveloAPP Boat Desk",
    backgroundColor: "#F5F2EB",
    autoHideMenuBar: true,
    // Prozor se skriva dok renderer nema što pokazati — inače bi preko splasha
    // sjedio prazan bijeli okvir.
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // minWidth iz opcija mjeri cijeli prozor, a nama treba širina SADRŽAJA. Okvir
  // (naslovna traka, rubovi) razlikuje se po OS-u i skaliranju ekrana, pa se
  // mjeri umjesto da se pogađa. Visina ostaje kakva je bila.
  const [winW] = win.getSize();
  const [contentW] = win.getContentSize();
  const [, minH] = win.getMinimumSize();
  win.setMinimumSize(CONTENT_MIN_WIDTH + (winW - contentW), minH);
  logToFile("minimalna sirina prozora:", CONTENT_MIN_WIDTH + (winW - contentW));

  // Blagajna radi preko cijelog zaslona: cetiri stupca i donja traka trebaju
  // svaki piksel, a blagajnik nema razloga drzati ispod prozora nesto drugo.
  // Uvecava se, ne ide u pravi fullscreen — naslovna traka i taskbar ostaju
  // dohvatljivi, za dijaloge pisaca i izlaz iz aplikacije.
  win.once("ready-to-show", () => {
    logToFile("ready-to-show");
    closeSplash();
    win.maximize();
    win.show();
    win.focus();
  });

  // Ako renderer ne javi ready-to-show (Vite nije podignut, index.html
  // nedostaje), splash bi ostao visjeti nad praznim ekranom. Nakon 30s se
  // odustaje i prozor se prikaže kakav jest, da se barem vidi greška.
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      logToFile("ready-to-show nije stigao u 30s — prikazujem prozor svejedno");
      closeSplash();
      win.maximize();
      win.show();
    }
  }, 30000);

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    logToFile("did-fail-load:", code, desc, url);
  });

  win.webContents.on("render-process-gone", (_e, details) => {
    logToFile("render-process-gone:", details);
  });

  win.webContents.on("before-input-event", (_event, input) => {
    if (input.control && input.shift && String(input.key).toLowerCase() === "i") {
      win.webContents.openDevTools({ mode: "detach" });
    }
  });

  // DEV vs PROD
  // DevTools se više ne otvaraju sami — ni u devu ni u prodakciji. Na blagajni
  // su smetali (otimali fokus i pola ekrana). Kad trebaju: Ctrl+Shift+I, ili
  // DEBUG_PROD za instalirani build.
  if (!app.isPackaged) {
    logToFile("MODE: dev", DEV_SERVER_URL);
    win.loadURL(DEV_SERVER_URL);
  } else {
    const indexHtml = getProdIndexHtmlPath();
    logToFile("MODE: prod", "indexHtml:", indexHtml);

    // Ako index.html ne postoji, odmah logiraj
    try {
      const exists = fs.existsSync(indexHtml);
      logToFile("indexHtml exists:", exists);
    } catch {}

    win.loadFile(indexHtml);

    if (DEBUG_PROD) {
      win.webContents.openDevTools({ mode: "detach" });
    }
  }

  return win;
}

// ── Tiha obnova access tokena (401 → refresh → retry) ───────────────────────
// Backend je dobio refresh tokene. Svi servisi zovu axios s "Bearer <token>"
// iz pairing_data. Kad access token istekne, core vraca 401. Umjesto da svaki
// servis pojedinacno hvata 401, presrecemo ga globalno ovdje: jednom obnovimo
// token preko refresh_tokena, azuriramo SAMO token+refresh_token u pairing_data
// (bez truncate — radni podaci, TID/pairing red i pending sync ostaju netaknuti)
// i ponovimo originalni zahtjev. Ako refresh padne, javimo rendereru
// 'app:sessionExpired' i pustimo gresku dalje.
const REFRESH_PATH = "/terminal_auth/login/terminalRefresh";
// Jedan in-flight refresh za sve istovremene 401 — inace bi svaki paralelni
// zahtjev pokrenuo svoj refresh i medusobno si potrli tokene.
let refreshing = null;

function notifySessionExpired() {
  for (const w of BrowserWindow.getAllWindows()) {
    try { w.webContents.send("app:sessionExpired"); } catch { /* ignore */ }
  }
}

async function performTokenRefresh() {
  const settingsData = await systemSettingsDataModel.findOne();
  const backendUrl = settingsData?.backend_url;
  const pairing = await pairingDataModel.findOne();
  const refreshToken = pairing?.refresh_token;
  if (!backendUrl || !refreshToken) {
    // Nema URL-a ili refresh tokena — obnova nije moguca.
    return null;
  }
  const resp = await axios.post(
    backendUrl + REFRESH_PATH,
    { refresh_token: refreshToken },
    {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      // Namjerno BEZ Authorization headera — access token je istekao, saljemo
      // samo refresh_token.
    }
  );
  // Toleriraj .data.data / .data wrap.
  const payload = resp?.data?.data ?? resp?.data ?? {};
  const token = payload.token;
  const newRefresh = payload.refresh_token ?? refreshToken;
  if (!token) return null;
  // Azuriramo SAMO token + refresh_token na postojecem redu. NE truncate,
  // NE create — TID/OTP/isPaired i sve ostalo ostaje.
  await pairingDataModel.update(
    { token, refresh_token: newRefresh },
    { where: { id: pairing.id } }
  );
  return token;
}

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config;

    // Ne diramo nista osim 401. Bez configa ne mozemo ponoviti zahtjev.
    if (status !== 401 || !original) {
      return Promise.reject(error);
    }
    // Guard protiv petlje: jedan retry po zahtjevu i nikad ne refreshamo na
    // odgovor samog refresh poziva.
    const isRefreshCall = typeof original.url === "string" && original.url.includes(REFRESH_PATH);
    if (original._retry || isRefreshCall) {
      if (isRefreshCall) notifySessionExpired();
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      // Istovremene 401 dijele jedan refresh promise.
      if (!refreshing) {
        refreshing = performTokenRefresh().finally(() => { refreshing = null; });
      }
      const newToken = await refreshing;
      if (!newToken) {
        // Nema refresh tokena ili obnova nije uspjela — sesija je stvarno gotova.
        notifySessionExpired();
        return Promise.reject(error);
      }
      // Ponovi originalni zahtjev s novim tokenom.
      original.headers = original.headers || {};
      original.headers.authorization = "Bearer " + newToken;
      return axios(original);
    } catch (refreshErr) {
      // Refresh je pao (npr. refresh token istekao/nevaljan → 401).
      notifySessionExpired();
      return Promise.reject(error);
    }
  }
);

// Heartbeat: pri pokretanju javi TID + verziju aplikacije poslužitelju, da se u
// administraciji vidi s kojom se verzijom uređaj spaja ("zadnje stanje po
// uređaju"). Fire-and-forget — telemetrija ne smije utjecati na rad.
async function reportDeviceVersion() {
  try {
    const settings = await systemSettingsDataModel.findOne();
    const pairing = await pairingDataModel.findOne();
    const backendUrl = settings?.backend_url;
    const tid = pairing?.tid;
    if (!backendUrl || !tid) return;
    await axios.post(
      backendUrl + "/terminal_auth/login/terminalReport",
      { tid, app_version: app.getVersion(), client: "desk" },
      { httpsAgent: new https.Agent({ rejectUnauthorized: false }), timeout: 10000 }
    );
    logToFile("verzija javljena posluzitelju:", app.getVersion());
  } catch (e) {
    logToFile("javljanje verzije nije uspjelo:", e?.message || String(e));
  }
}

console.log("MAIN:", process.versions);

// Jedna instanca. Druga se odmah gasi, a fokus ide na postojeci prozor. Vise
// instanci bi se otimalo oko SQLite baze, a i zbunjuje auto-update installer
// (uninstaller stare verzije naleti na jos zakljucane datoteke druge instance).
const imamKljuc = app.requestSingleInstanceLock();
if (!imamKljuc) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}

app.whenReady().then(async () => {
  const startedAt = Date.now();
  logToFile("=== APP START ===", new Date().toISOString(), "isPackaged:", app.isPackaged);
  // Prvo splash, tek onda baza — priprema baze je i najduži dio starta.
  createSplash();
  try {
    await sequelize.authenticate();
    await sequelize.sync({alter:true}).then(()=> console.log('db is ready'))
    //await sequelize.sync(); // za početak OK (kasnije migracije)
  } catch (dbErr) {
    // Bez ovoga bi splash ostao na ekranu zauvijek, a glavni prozor se ne bi ni
    // stvorio — izgledalo bi kao da se aplikacija zaglavila na "Priprema podataka".
    logToFile("greska pri pripremi baze:", dbErr?.stack || String(dbErr));
    closeSplash();
    throw dbErr;
  }
  logToFile("baza spremna nakon", Date.now() - startedAt, "ms");
  // Prava verzija aplikacije za prikaz u rendereru (podnožje prijavnog ekrana).
  // __APP_VERSION__ u rendereru zna ostati star ako se bundle ne rebuilda, pa je
  // app.getVersion() jedini pouzdan izvor.
  ipcMain.handle("app:getVersion", () => app.getVersion());
  // Renderer može zatražiti javljanje verzije (osim na startu, i pri prijavi te
  // zatvaranju smjene) — telemetrija, fire-and-forget.
  ipcMain.handle("app:reportVersion", () => { reportDeviceVersion().catch(() => {}); return true; });

  registerIpcHandlers();
  createWindow();

  // Automatsko ažuriranje: preuzima u pozadini, a instalira/ponovno pokreće tek
  // dok je app na prijavnom ekranu (nikad usred prodaje). Vidi updateService.
  initAutoUpdate({ logToFile });

  // Pending-invoice + pending-shift sync. Jednom 5s nakon starta (DB + pairing
  // ready), pa svakih 60s. Backend je idempotentan po uuid-u pa retry je siguran.
  // Otvorena veza prema posluzitelju: kad se polazak otkaze ili pomakne, javi se
  // sam, pa blagajna ne prodaje polazak kojeg vise nema. Kasni start, da baza i
  // uparivanje budu spremni.
  setTimeout(() => { startSyncStreamService() }, 8000)

  // Javljanje verzije poslužitelju (heartbeat) — nakon što su baza i pairing spremni.
  setTimeout(() => { reportDeviceVersion().catch(() => {}) }, 9000)

  setTimeout(() => { syncPendingInvoicesService().catch(() => {}) }, 5000)
  setTimeout(() => { syncPendingShiftsService().catch(() => {}) }, 6000)
  setInterval(() => { syncPendingInvoicesService().catch(() => {}) }, 60000)
  setInterval(() => { syncPendingShiftsService().catch(() => {}) }, 60000)

  // Ispisane kopije karata: oznaku im blagajna dodijeli sama, pa poslužitelj za
  // njih saznaje tek ovdje. Ide u istom ritmu kao ostalo zaostalo.
  setTimeout(() => { syncPendingCopyPrintsService().catch(() => {}) }, 7000)
  setInterval(() => { syncPendingCopyPrintsService().catch(() => {}) }, 60000)

  // Smjena se ne prenosi u sljedeći dan — ono što u 01:00 još stoji otvoreno
  // zatvara se samo. Provjera ide i pri pokretanju, jer je blagajna preko noći
  // najčešće ugašena, pa se granica prijeđe dok aplikacija ne radi.
  // Nakon automatskog zatvaranja vrijedi isto kao kod ručnog: zaostalo ode u
  // sustav, podaci se osvježe za sljedeću smjenu, a renderer se obavijesti da
  // odjavi operatera — blagajna ujutro dočeka prijavni ekran.
  const autoCloseIObavijesti = async () => {
    const res = await autoCloseShiftsService().catch(() => ({ closed: 0 }))
    if (!res?.closed) return
    try {
      await syncPendingInvoicesService()
      await syncPendingShiftsService()
      await syncBasicDataService()
      await syncTransportDataService()
    } catch (e) {
      logToFile("sync nakon automatskog zatvaranja nije prošao:", e?.message || String(e))
    }
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send("app:shiftAutoClosed", { closed: res.closed })
    }
  }
  setTimeout(() => { autoCloseIObavijesti().catch(() => {}) }, 7000)
  setInterval(() => { autoCloseIObavijesti().catch(() => {}) }, 5 * 60 * 1000)
});

const pairing = systemSettingsDataModel.findOne();

app.on("window-all-closed", () => {
  // standard Windows behavior: quit
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  // macOS behavior (nije kritično na Windowsu, ali ok je)
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
