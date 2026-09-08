// Slaze UPUTE_ZA_OPERATERA.html u PDF. Dokument je samostalan — slike su u
// njemu kao data URI — pa se samo ucita u Chromium i ispise.
//
// Pokretanje:  node travelo-mobile/docs/upute/_alat/build_pdf.js
const fs = require("fs");
const path = require("path");
const { chromium } = require("C:/Tech4beeZ/Projekti/TraveloApp/travelo-portal/docs/upute/_shotter/node_modules/playwright");

const SRC = path.resolve(__dirname, "..", "UPUTE_ZA_OPERATERA.html");
const OUT_PDF = path.resolve(__dirname, "..", "..", "TraveloAPP-upute-za-operatera-1.0.6.pdf");

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    // Fontovi se povlace s mreze; bez cekanja bi prvi ispis bio u zamjenskom fontu.
    await page.setContent(fs.readFileSync(SRC, "utf8"), { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
        path: OUT_PDF,
        format: "A4",
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    await browser.close();
    console.log("Wrote", OUT_PDF, `(${Math.round(fs.statSync(OUT_PDF).size / 1024)} KB)`);
})();
