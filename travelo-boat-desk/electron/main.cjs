// electron/main.cjs
const path = require("path");
const fs = require("fs");
const { app, BrowserWindow } = require("electron");
const { sequelize } = require("./db/index.cjs");
const { registerIpcHandlers } = require("./ipc/index.cjs");
const { pairingDataModel } = require("./db/models/Pairing.cjs");
const { systemSettingsDataModel } = require("./db/models/Settings.cjs");
const { syncPendingInvoicesService } = require("./services/invoiceDataService.cjs");
const { syncPendingShiftsService } = require("./services/shiftsDataService.cjs");

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

function createWindow() {
  logToFile("createWindow()");
  const win = new BrowserWindow({
    width: 1700,
    height: 1100,
    minWidth: 1200,
    minHeight: 1100,
    title: "TraveloAPP Boat Desk",
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    show: true,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.once("ready-to-show", () => {
    logToFile("ready-to-show");
    win.show();
  });

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

console.log("MAIN:", process.versions);

app.whenReady().then(async () => {
  logToFile("=== APP START ===", new Date().toISOString(), "isPackaged:", app.isPackaged);
  await sequelize.authenticate();
  await sequelize.sync({alter:true}).then(()=> console.log('db is ready'))
  //await sequelize.sync(); // za početak OK (kasnije migracije)
  registerIpcHandlers();
  createWindow();

  // Pending-invoice + pending-shift sync. Jednom 5s nakon starta (DB + pairing
  // ready), pa svakih 60s. Backend je idempotentan po uuid-u pa retry je siguran.
  setTimeout(() => { syncPendingInvoicesService().catch(() => {}) }, 5000)
  setTimeout(() => { syncPendingShiftsService().catch(() => {}) }, 6000)
  setInterval(() => { syncPendingInvoicesService().catch(() => {}) }, 60000)
  setInterval(() => { syncPendingShiftsService().catch(() => {}) }, 60000)
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
