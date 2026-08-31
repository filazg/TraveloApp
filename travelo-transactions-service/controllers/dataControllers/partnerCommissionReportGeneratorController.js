const crypto = require("crypto");
const axios = require("axios");

const { getSequelize } = require("../../config/database");
const { getModels } = require("../../dbModels");
const { getCoreServiceConfigData } = require("../configSyncController");
const { prikupiDetalje, razdobljePoDinamici } = require("./partnerCommissionController");

// Generiranje izvjestaja za proviziju po dinamici partnera.
//
// Razdoblje se ne bira rukom: dinamika (MONTHLY / SEMI_MONTHLY / WEEKLY) stoji
// na partneru, a razdobljePoDinamici vraca zadnje ZATVORENO razdoblje na dan
// pokretanja. Dok se sljedece ne zatvori, svako pokretanje vraca isto razdoblje
// — zato je provjera postojanja kljucna: izvjestaj nastaje jednom po paru
// (partner, razdoblje), pa cron moze vrtjeti koliko god cesto.
//
// Brojke se zamrzavaju. Izvjestaj je podloga po kojoj partner nama ispostavlja
// racun, pa se ne smije mijenjati ako se karta naknadno stornira.

async function dohvatiPartnere() {
    const coreConfig = await getCoreServiceConfigData();
    const boUrl = coreConfig?.services?.backoffice?.url;
    if (!boUrl) throw new Error("backoffice service URL missing from core config");
    const resp = await axios.get(`${boUrl}/partners`, { timeout: 10000 });
    return resp.data?.data?.partners || [];
}

const zbroj = (niz, kljuc) =>
    +niz.reduce((z, r) => z + (Number(r[kljuc]) || 0), 0).toFixed(2);

const generatePartnerCommissionReports = async ({ asOfDate = new Date(), partnerUuid = null } = {}) => {
    const {
        TicketsModel,
        InvoiceModel,
        PartnerCommissionReportModel,
        PartnerCommissionReportItemModel,
    } = getModels();
    const sequelize = getSequelize();

    const result = { reports: [], partners_skipped: [] };

    const sviPartneri = await dohvatiPartnere();
    const partneri = sviPartneri.filter(
        (p) => p.is_active !== false && (!partnerUuid || p.uuid === partnerUuid)
    );

    const godina = asOfDate.getFullYear();
    const maxRed = await PartnerCommissionReportModel.findOne({
        where: { report_year: godina },
        order: [["report_no", "DESC"]],
    });
    let sljedeciBroj = (maxRed?.report_no || 0) + 1;

    for (const partner of partneri) {
        const razdoblje = razdobljePoDinamici(partner, asOfDate, false);
        const oznakaRazdoblja = `${razdoblje.from} – ${razdoblje.to}`;

        const vecPostoji = await PartnerCommissionReportModel.findOne({
            where: {
                partner_uuid: partner.uuid,
                period_from: razdoblje.from,
                period_to: razdoblje.to,
            },
        });
        if (vecPostoji) {
            result.partners_skipped.push({
                partner_uuid: partner.uuid,
                partner_name: partner.partner_name,
                reason: `vec generiran za ${oznakaRazdoblja}`,
            });
            continue;
        }

        let detalji;
        try {
            detalji = await prikupiDetalje({
                TicketsModel,
                InvoiceModel,
                partner_uuid: partner.uuid,
                from: razdoblje.from,
                to: razdoblje.to,
            });
        } catch (err) {
            result.partners_skipped.push({
                partner_uuid: partner.uuid,
                partner_name: partner.partner_name,
                reason: `prikupljanje nije uspjelo: ${err?.message || err}`,
            });
            continue;
        }

        const redci = detalji.rows || [];
        if (!redci.length) {
            result.partners_skipped.push({
                partner_uuid: partner.uuid,
                partner_name: partner.partner_name,
                reason: `nema prodaje u razdoblju ${oznakaRazdoblja}`,
            });
            continue;
        }

        const reportUuid = crypto.randomUUID();
        const broj = sljedeciBroj;
        const zaglavlje = {
            report_uuid: reportUuid,
            report_no: broj,
            report_year: godina,
            partner_uuid: partner.uuid,
            partner_name: detalji.partner_name || partner.partner_name || "",
            partner_legal_id: detalji.partner_legal_id || partner.partner_legal_id || null,
            company_name: detalji.company_name || "",
            billing_cycle: razdoblje.cycle || partner.billing_cycle || "MONTHLY",
            billing_weekday: partner.billing_weekday ?? null,
            period_from: razdoblje.from,
            period_to: razdoblje.to,
            tickets_count: redci.length,
            gross_amount: zbroj(redci, "gross"),
            base_amount: zbroj(redci, "base"),
            commission_pct: Number(detalji.commission_pct) || 0,
            commission_amount: zbroj(redci, "commission"),
            status: "generated",
            generated_at: asOfDate,
        };

        const stavke = redci.map((r) => ({
            report_uuid: reportUuid,
            scope: r.scope || null,
            business_premise_name: r.business_premise_name || null,
            billing_device: r.billing_device || null,
            operator: r.operator || null,
            username: r.username || null,
            order_uuid: r.order_uuid || null,
            order_number: r.order_number || null,
            order_note: r.order_note || null,
            passanger_name: r.passanger_name || null,
            ticket_code: r.ticket_code || null,
            ticket_type_name: r.ticket_type_name || null,
            route_uuid: r.route_uuid || null,
            line_name: r.line_name || null,
            departure_harbor_name: r.departure_harbor_name || null,
            arrival_harbor_name: r.arrival_harbor_name || null,
            departure_planed: r.departure_planed || null,
            sold_at: r.sold_at || null,
            gross_amount: Number(r.gross) || 0,
            base_amount: Number(r.base) || 0,
            commission_amount: Number(r.commission) || 0,
        }));

        // Zaglavlje i stavke idu zajedno: izvjestaj bez stavki nije podloga ni za
        // sto, a stavke bez zaglavlja ostaju siroce.
        const t = await sequelize.transaction();
        try {
            await PartnerCommissionReportModel.create(zaglavlje, { transaction: t });
            await PartnerCommissionReportItemModel.bulkCreate(stavke, { transaction: t });
            await t.commit();
        } catch (err) {
            await t.rollback();
            result.partners_skipped.push({
                partner_uuid: partner.uuid,
                partner_name: partner.partner_name,
                reason: `zapis nije uspio: ${err?.message || err}`,
            });
            continue;
        }

        // Broj se trosi tek kad je izvjestaj stvarno zapisan, da neuspjeli
        // pokusaj ne ostavi rupu u nizu.
        sljedeciBroj += 1;
        result.reports.push(zaglavlje);
    }

    return result;
};

module.exports = { generatePartnerCommissionReports };
