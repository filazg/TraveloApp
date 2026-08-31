const { Op } = require("sequelize");
const {
    generatePartnerCommissionReports,
} = require("./partnerCommissionReportGeneratorController");

// Citanje generiranih izvjestaja za proviziju. Za razliku od /partner_commission,
// koji racuna zivu sliku iz karata, ovdje se vracaju zamrznute snimke — ono sto
// je partner stvarno dobio u ruke.

const listPartnerCommissionReportsController = async (req, res) => {
    const { PartnerCommissionReportModel } = req.app.locals.models;
    try {
        const { year, partner_uuid, from, to } = req.query || {};
        const where = {};
        if (year) where.report_year = Number(year);
        if (partner_uuid) where.partner_uuid = partner_uuid;
        // Filtar po razdoblju hvata izvjestaje koji se preklapaju s trazenim
        // rasponom, a ne samo one koji u njega upadaju cijeli.
        if (from) where.period_to = { [Op.gte]: from };
        if (to) where.period_from = { [Op.lte]: to };

        const reports = await PartnerCommissionReportModel.findAll({
            where,
            order: [["report_year", "DESC"], ["report_no", "DESC"]],
        });

        const totals = reports.reduce(
            (z, r) => ({
                tickets: z.tickets + (Number(r.tickets_count) || 0),
                gross: +(z.gross + (Number(r.gross_amount) || 0)).toFixed(2),
                base: +(z.base + (Number(r.base_amount) || 0)).toFixed(2),
                commission: +(z.commission + (Number(r.commission_amount) || 0)).toFixed(2),
            }),
            { tickets: 0, gross: 0, base: 0, commission: 0 }
        );

        res.send({ status: 200, data: { reports, totals } });
    } catch (error) {
        console.log("listPartnerCommissionReportsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const getPartnerCommissionReportDetailsController = async (req, res) => {
    const { PartnerCommissionReportModel, PartnerCommissionReportItemModel } = req.app.locals.models;
    try {
        const { report_uuid } = req.params;
        const report = await PartnerCommissionReportModel.findOne({ where: { report_uuid } });
        if (!report) {
            return res.status(404).send({ status: 404, data: { message: "izvjestaj nije pronaden" } });
        }
        const items = await PartnerCommissionReportItemModel.findAll({
            where: { report_uuid },
            order: [["id", "ASC"]],
        });
        res.send({ status: 200, data: { report, items } });
    } catch (error) {
        console.log("getPartnerCommissionReportDetailsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Rucno pokretanje istog posla koji nocu odradi cron. Sluzi za provjeru i za
// slucaj da je cron preskocen; ponasa se jednako, pa ponovljeno pokretanje ne
// stvara duplikate.
const generatePartnerCommissionReportsController = async (req, res) => {
    try {
        const data = req.body?.body || req.body || {};
        const asOfDate = data.as_of_date ? new Date(data.as_of_date) : new Date();
        if (Number.isNaN(asOfDate.getTime())) {
            return res.status(400).send({ status: 400, data: { message: "as_of_date nije ispravan datum" } });
        }
        const result = await generatePartnerCommissionReports({
            asOfDate,
            partnerUuid: data.partner_uuid || null,
        });
        res.send({ status: 200, data: result });
    } catch (error) {
        console.log("generatePartnerCommissionReportsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    listPartnerCommissionReportsController,
    getPartnerCommissionReportDetailsController,
    generatePartnerCommissionReportsController,
};
