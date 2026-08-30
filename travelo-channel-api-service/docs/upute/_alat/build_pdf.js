// Slaze UPUTE_ZA_API_PARTNERE.md u PDF. Isti postupak kao za portalske upute:
// marked pretvara markdown u html, Chromium ga ispisuje u PDF.
//
// Pokretanje:  node docs/upute/_alat/build_pdf.js
const fs = require("fs");
const path = require("path");
const { marked } = require("C:/Tech4beeZ/Projekti/TraveloApp/travelo-portal/docs/upute/_shotter/node_modules/marked");
const { chromium } = require("C:/Tech4beeZ/Projekti/TraveloApp/travelo-portal/docs/upute/_shotter/node_modules/playwright");

const SRC = path.resolve(__dirname, "..", "UPUTE_ZA_API_PARTNERE.md");
const IMG_DIR = path.resolve(__dirname, "..", "images");
const OUT_PDF = path.resolve(__dirname, "..", "TraveloAPP-Partner-API-upute-1.05.pdf");

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

const css = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: #1f2937;
    font-size: 11pt;
    line-height: 1.55;
    max-width: 100%;
}
h1 { font-size: 22pt; margin: 0 0 12px; color: #0f172a; border-bottom: 2px solid #2E53A0; padding-bottom: 6px; }
h2 { font-size: 16pt; margin: 22px 0 8px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; page-break-after: avoid; }
h3 { font-size: 13pt; margin: 16px 0 4px; color: #1e3a8a; page-break-after: avoid; }
h4 { font-size: 11.5pt; margin: 12px 0 3px; color: #1e3a8a; }
p { margin: 6px 0; }
ul, ol { margin: 6px 0 6px 20px; }
li { margin: 2px 0; }
hr { border: 0; border-top: 1px solid #cbd5e1; margin: 18px 0; }
code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 10pt; }
pre { background: #0f172a; color: #f1f5f9; padding: 10px 12px; border-radius: 6px; overflow: auto; font-size: 9.5pt; }
pre code { background: transparent; color: inherit; padding: 0; }
blockquote { border-left: 3px solid #2E53A0; background: #f8fafc; padding: 6px 12px; margin: 8px 0; color: #334155; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 10pt; }
th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #f1f5f9; }
img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 10px auto;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(15,23,42,0.08);
    page-break-inside: avoid;
}
a { color: #2E53A0; text-decoration: none; }
a:hover { text-decoration: underline; }
h2, h3 { page-break-inside: avoid; }
`;

const fullHtml = `<!doctype html>
<html lang="hr">
<head>
<meta charset="utf-8">
<title>TraveloAPP Partner API — Upute za partnere</title>
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
