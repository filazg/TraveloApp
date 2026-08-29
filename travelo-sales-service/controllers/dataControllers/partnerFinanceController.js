const axios = require("axios");
const { getCoreServiceConfigData } = require("../configSyncController");

// Financijski pregled za partnera: njegov obracun provizije i racuni koje mu
// izdajemo. Podaci zive u transakcijama, ali partner ne smije do njih izravno —
// ondje su svi partneri. Zato se ovdje prosljeduje s partnerom iz PRIJAVE, a ne
// iz upita: klijent bi inace poslao tudi uuid i vidio tudi promet.
//
// Ista razrada koju vidi nas knjigovoda u portalu, samo suzena na jednog
// partnera i bez trazilice po partnerima — partner ima samo sebe.

const naTransakcije = async (putanja, params, opcije = {}) => {
    const coreConfig = await getCoreServiceConfigData();
    const txUrl = coreConfig?.services?.transactions?.url;
    if (!txUrl) throw new Error("transactions servis nije dostupan");
    return axios.get(`${txUrl}${putanja}`, {
        params,
        timeout: 20000,
        validateStatus: () => true,
        ...opcije,
    });
};

const posaljiJson = (res, resp) => {
    const tijelo = resp.data?.data !== undefined ? resp.data.data : resp.data;
    return res.status(200).json({ status: resp.status, data: tijelo });
};

const posaljiPdf = (res, resp, naziv) => {
    res.status(resp.status);
    res.setHeader("content-type", resp.headers["content-type"] || "application/pdf");
    res.setHeader("content-disposition", resp.headers["content-disposition"] || `inline; filename="${naziv}"`);
    return res.send(Buffer.from(resp.data));
};

// Obracun provizije — razdoblje po dinamici naplate partnera, kao i u portalu.
const partnerCommissionController = async (req, res) => {
    try {
        const resp = await naTransakcije("/partner_commission", {
            partner_uuid: req.partner.partner_uuid,
            period: req.query.period,
            from: req.query.from,
            to: req.query.to,
        });
        return posaljiJson(res, resp);
    } catch (error) {
        console.log("partnerCommissionController error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

const partnerCommissionDetailsController = async (req, res) => {
    try {
        const resp = await naTransakcije("/partner_commission_details", {
            partner_uuid: req.partner.partner_uuid,
            period: req.query.period,
            from: req.query.from,
            to: req.query.to,
        });
        return posaljiJson(res, resp);
    } catch (error) {
        console.log("partnerCommissionDetailsController error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

const partnerCommissionReportPdfController = (detalji) => async (req, res) => {
    try {
        const putanja = detalji ? "/partner_commission_report_details_pdf" : "/partner_commission_report_pdf";
        const resp = await naTransakcije(putanja, {
            partner_uuid: req.partner.partner_uuid,
            period: req.query.period,
            from: req.query.from,
            to: req.query.to,
        }, { responseType: "arraybuffer" });
        return posaljiPdf(res, resp, `izvjestaj-provizija${detalji ? "-detalji" : ""}.pdf`);
    } catch (error) {
        console.log("partnerCommissionReportPdfController error:", error?.message || error);
        return res.status(500).send("PDF nije uspio");
    }
};

// Racuni koje mu izdajemo za prodaju u njegovo ime.
const partnerInvoicesController = async (req, res) => {
    try {
        const resp = await naTransakcije("/partner_invoices", {
            partner_uuid: req.partner.partner_uuid,
            year: req.query.year,
            month: req.query.month,
        });
        return posaljiJson(res, resp);
    } catch (error) {
        console.log("partnerInvoicesController error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

// Racun mora biti njegov: bez provjere bi se tudi racun otvorio poznavanjem
// oznake, a ona stoji na dokumentu.
const dohvatiRacun = async (partner_uuid, partner_invoice_uuid) => {
    const coreConfig = await getCoreServiceConfigData();
    const txUrl = coreConfig?.services?.transactions?.url;
    const resp = await axios.get(`${txUrl}/partner_invoice/${partner_invoice_uuid}`, {
        timeout: 20000,
        validateStatus: () => true,
    });
    const podaci = resp.data?.data;
    const racun = podaci?.invoice;
    if (resp.status !== 200 || !racun || racun.partner_uuid !== partner_uuid) return null;
    return { podaci, status: resp.status };
};

const partnerInvoiceController = async (req, res) => {
    try {
        const nadeno = await dohvatiRacun(req.partner.partner_uuid, req.params.partner_invoice_uuid);
        if (!nadeno) return res.status(404).json({ status: 404, data: { message: "Račun nije pronađen" } });
        return res.status(200).json({ status: 200, data: nadeno.podaci });
    } catch (error) {
        console.log("partnerInvoiceController error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

const partnerInvoicePdfController = (detalji) => async (req, res) => {
    try {
        const { partner_invoice_uuid } = req.params;
        const nadeno = await dohvatiRacun(req.partner.partner_uuid, partner_invoice_uuid);
        if (!nadeno) return res.status(404).send("Račun nije pronađen");
        const putanja = detalji ? "/partner_invoice_details_pdf/" : "/partner_invoice_pdf/";
        const resp = await naTransakcije(putanja + partner_invoice_uuid, {}, { responseType: "arraybuffer" });
        return posaljiPdf(res, resp, `partner-racun${detalji ? "-detalji" : ""}.pdf`);
    } catch (error) {
        console.log("partnerInvoicePdfController error:", error?.message || error);
        return res.status(500).send("PDF nije uspio");
    }
};

module.exports = {
    partnerCommissionController,
    partnerCommissionDetailsController,
    partnerCommissionReportPdfController,
    partnerInvoicesController,
    partnerInvoiceController,
    partnerInvoicePdfController,
};
