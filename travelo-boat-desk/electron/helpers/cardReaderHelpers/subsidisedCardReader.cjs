const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { app } = require("electron");

function getTesseraCliPath() {
  if (app.isPackaged) {
    // u instaliranoj app
    return path.join(process.resourcesPath, "tessera-cli", "TesseraCli.exe");
  }
  // u devu
  //return path.join(__dirname, "resources", "tessera-cli", "TesseraCli.exe");
  return path.join(process.cwd(), "resources", "tessera-cli", "TesseraCli.exe");
}

function runTesseraCli(args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const exe = getTesseraCliPath();

    // ✅ jasna greška ako putanja nije dobra
    if (!fs.existsSync(exe)) {
      return reject(
        new Error(`TesseraCli.exe not found at: ${exe}`)
      );
    }

    const p = spawn(exe, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let out = "";
    let err = "";

    const timer = setTimeout(() => {
      try { p.kill(); } catch {}
      reject(new Error("CLI timeout"));
    }, timeoutMs);

    p.stdout.on("data", (d) => (out += d.toString("utf8")));
    p.stderr.on("data", (d) => (err += d.toString("utf8")));

    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });

    p.on("close", () => {
      clearTimeout(timer);

      const text = out.trim();

      // ✅ ako nema stdout, pokaži stderr
      if (!text) {
        return reject(new Error(`No JSON on stdout.\nERR=${err}`));
      }

      try {
        resolve(JSON.parse(text));
      } catch (e) {
        reject(new Error(`Bad JSON:\n${e.message}\nOUT=${out}\nERR=${err}`));
      }
    });
  });
}

module.exports = { runTesseraCli, getTesseraCliPath };
