// PDF obračuna lučkih naknada — zbirno za sve uprave ili za jednu upravu.
//
// Brojke dolaze iz istog izračuna kao i izvještaj na ekranu
// (buildHarborTaxReport), pa se preuzeti dokument i portal ne mogu razići.
// Bez ?region= u PDF idu sve uprave; s njim samo tražena, jer se svakoj upravi
// predaje njezin obračun.
const axios = require("axios");
const { renderTemplateToPdfBuffer } = require("../../helpers/pdfRenderer");
const { getCoreServiceConfigData } = require("../configSyncController");
const { buildHarborTaxReport, norm, HARBOR_RATE } = require("./harborTaxReportController");

const MONTHS_HR = [
    "siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj",
    "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac",
];

const fmt = (n) =>
    Number(n || 0).toFixed(2).replace(".", ",") + " €";

const pad2 = (n) => String(n).padStart(2, "0");

// Datum izrade u lokalnom vremenu — dokument se predaje lučkoj upravi, pa UTC
// ispis zna odlutati u prethodni dan.
const localStamp = (d) =>
    `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}. ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

// Naziv uprave u ime datoteke: bez dijakritike i razmaka, da ga preglednik i
// mail klijent ne prekroje.
const slug = (s) =>
    String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();

const fetchCompany = async () => {
    try {
        const core = await getCoreServiceConfigData();
        const boUrl = core?.services?.backoffice?.url;
        if (!boUrl) return {};
        const r = await axios.get(`${boUrl}/company`, { timeout: 8000 });
        const payload = r.data?.data || r.data || {};
        const company = Array.isArray(payload.company) ? payload.company[0] : payload.company;
        return company || {};
    } catch (error) {
        // Zaglavlje s podacima prijevoznika je poželjno, ali izvještaj bez njega
        // i dalje ima smisla — brojke su bitne.
        console.log("harborTaxPdf fetchCompany failed:", error?.message || error);
        return {};
    }
};

const harborTaxPdfController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const year = parseInt(req.query.year, 10);
        const month = parseInt(req.query.month, 10);
        const region = req.query.region ? String(req.query.region) : null;
        if (!year) return res.status(400).send("year required");

        const report = await buildHarborTaxReport({ TicketsModel, year, month });

        let regions = report.by_region;
        let scopeLabel = "Sve lučke uprave";
        if (region) {
            // Uprava se traži po uuid-u; luke koje još nisu povezane s upravom
            // nemaju uuid, pa se prihvaća i naziv.
            regions = regions.filter(
                (r) => r.region_key === region || r.region_uuid === region || norm(r.region_name) === norm(region)
            );
            if (!regions.length) return res.status(404).send("Lučka uprava nije pronađena u izvještaju");
            scopeLabel = regions[0].region_name;
        }

        const totalAmount = +regions.reduce((s, r) => s + r.total, 0).toFixed(2);
        const totalTickets = regions.reduce((s, r) => s + r.tickets, 0);

        const company = await fetchCompany();
        const periodLabel = month
            ? `${MONTHS_HR[month - 1]} ${year}.`
            : `godina ${year}.`;

        const buffer = await renderTemplateToPdfBuffer("harborTaxTemplate.ejs", {
            title: `Obračun lučkih naknada ${periodLabel}`,
            company,
            regions,
            totalAmount,
            totalTickets,
            scopeLabel,
            periodLabel,
            // Kad je u dokumentu samo jedna uprava, zaglavlje koje najavljuje
            // razradu "po lučkim upravama" zvuči kao da nešto nedostaje.
            sectionTitle: region
                ? "Razrada po lukama polaska"
                : "Razrada po lučkim upravama i lukama polaska",
            firstColumnLabel: region ? "Luka polaska" : "Lučka uprava / luka polaska",
            generatedAt: localStamp(new Date()),
            ratePct: +(HARBOR_RATE * 100).toFixed(2),
            fmt,
        });

        const periodPart = month ? `${year}-${pad2(month)}` : `${year}`;
        const filename = region
            ? `lucke-naknade-${periodPart}-${slug(scopeLabel)}.pdf`
            : `lucke-naknade-${periodPart}-sve-uprave.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.end(buffer);
    } catch (error) {
        console.log("harborTaxPdfController error:", error?.message || error);
        return res.status(500).send("Harbor tax PDF generation failed");
    }
};

module.exports = { harborTaxPdfController };
