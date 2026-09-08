// Slaze UPUTE_ZA_BLAGAJNIKA.md u PDF. Isti postupak kao za portalske upute:
// marked pretvara markdown u html, Chromium ga ispisuje u PDF.
//
// Pokretanje:  node docs/upute/_alat/build_pdf.js
const fs = require("fs");
const path = require("path");
const { marked } = require("C:/Tech4beeZ/Projekti/TraveloApp/travelo-portal/docs/upute/_shotter/node_modules/marked");
const { chromium } = require("C:/Tech4beeZ/Projekti/TraveloApp/travelo-portal/docs/upute/_shotter/node_modules/playwright");

const SRC = path.resolve(__dirname, "..", "UPUTE_ZA_BLAGAJNIKA.md");
const IMG_DIR = path.resolve(__dirname, "..", "images");
const OUT_PDF = path.resolve(__dirname, "..", "TraveloAPP-Boat-Desk-upute-za-blagajnika-1.0.25.pdf");

const md = fs.readFileSync(SRC, "utf8");

// Render markdown -> html
const bodyHtml = marked.parse(md, {
    mangle: false,
    headerIds: true,
    gfm: true,
});

// Inline images as file:// URLs so Chromium loads them from disk
const resolvedHtml = bodyHtml.replace(
    /src="images\/([^"]+)"/g,
    (_, name) => `src="file:///${path.join(IMG_DIR, name).replace(/\\/g, "/")}"`
);

// Izgled dolazi iz zajednickog stila; ovdje stoji samo ono sto je posebno
// za ovaj dokument.
const css = fs.readFileSync("C:/Tech4beeZ/Projekti/TraveloApp/docs/upute/stil.css", "utf8");

const fullHtml = `<!doctype html>
<html lang="hr">
<head>
<meta charset="utf-8">
<title>TraveloAPP Boat Desk — Upute za blagajnika</title>
<style>${css}</style>
</head>
<body>
${resolvedHtml}
</body>
</html>`;

(async () => {
    const tmpHtml = path.resolve(__dirname, "_upute.html");
    fs.writeFileSync(tmpHtml, fullHtml, "utf8");

    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("file:///" + tmpHtml.replace(/\\/g, "/"), { waitUntil: "networkidle" });

    await page.pdf({
        path: OUT_PDF,
        format: "A4",
        printBackground: true,
        margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
    });

    await browser.close();
    fs.unlinkSync(tmpHtml);

    const sizeKb = Math.round(fs.statSync(OUT_PDF).size / 1024);
    console.log(`Wrote ${OUT_PDF} (${sizeKb} KB)`);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
