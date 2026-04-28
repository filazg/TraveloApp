const path = require("path");
const fs = require("fs");
const ejs = require("ejs");
const puppeteer = require("puppeteer");

const TEMPLATES_DIR = path.resolve(__dirname, "..", "views");

let browserPromise = null;
const getBrowser = () => {
    if (!browserPromise) {
        browserPromise = puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        browserPromise.catch((err) => {
            console.log("puppeteer launch failed:", err?.message || err);
            browserPromise = null;
        });
    }
    return browserPromise;
};

const closeBrowser = async () => {
    if (!browserPromise) return;
    try {
        const browser = await browserPromise;
        await browser.close();
    } catch (e) {
        // ignore
    }
    browserPromise = null;
};

process.on("exit", closeBrowser);
process.on("SIGINT", closeBrowser);
process.on("SIGTERM", closeBrowser);

const renderEjsTemplate = (templateName, data) => {
    const templatePath = path.join(TEMPLATES_DIR, templateName);
    const source = fs.readFileSync(templatePath, "utf8");
    return ejs.render(source, data, { filename: templatePath });
};

const renderHtmlToPdfBuffer = async (html, opts = {}) => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        // `domcontentloaded` is sufficient when resources are inlined (QR as data URI,
        // no external CDN). We avoid networkidle* to prevent hangs when a 3rd-party
        // asset is slow/unreachable.
        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });
        const result = await page.pdf({
            format: opts.format || "A4",
            printBackground: true,
            margin: opts.margin || { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
            timeout: 15000,
        });
        // Puppeteer 22+ returns Uint8Array; normalize to Node Buffer so callers
        // (email attachments via .toString('base64'), raw writes, etc.) behave.
        return Buffer.isBuffer(result) ? result : Buffer.from(result);
    } finally {
        await page.close();
    }
};

const renderTemplateToPdfBuffer = async (templateName, data, opts) => {
    const html = renderEjsTemplate(templateName, data);
    return renderHtmlToPdfBuffer(html, opts);
};

module.exports = {
    renderEjsTemplate,
    renderHtmlToPdfBuffer,
    renderTemplateToPdfBuffer,
    closeBrowser,
};
