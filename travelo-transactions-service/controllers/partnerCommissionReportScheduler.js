const cron = require("node-cron");
const {
    generatePartnerCommissionReports,
} = require("./dataControllers/partnerCommissionReportGeneratorController");

// Razdoblja po dinamici partnera zatvaraju se na granici dana, pa se izvjestaji
// rade jednom nocu. Cesce nema smisla: generator ionako preskace razdoblje koje
// je vec obradeno, a dok se tekuce ne zatvori nema sto novo zapisati.
//
// Vrijeme pokretanja ne pomice granicu razdoblja. Ono sto ulazi u izvjestaj
// odreduje datum prodaje, a ne trenutak prolaza: krajDana(period_to) je uvijek
// 23:59:59.999 zadnjeg dana razdoblja. Prodaja izmedu ponoci i pokretanja zato
// pada u sljedece razdoblje, ne u ono koje se upravo zakljucuje.
const CRON_EXPR = "0 3 * * *";
const CRON_TZ = "Europe/Zagreb";

function startPartnerCommissionReportScheduler() {
    const task = cron.schedule(
        CRON_EXPR,
        async () => {
            const startedAt = new Date();
            console.log(`[commission-report-cron] firing at ${startedAt.toISOString()}`);
            try {
                const result = await generatePartnerCommissionReports({ asOfDate: startedAt });
                const izdano = result.reports.length;
                const preskoceno = result.partners_skipped.length;
                const ukupno = result.reports.reduce(
                    (s, r) => s + (parseFloat(r.commission_amount) || 0),
                    0
                );
                console.log(
                    `[commission-report-cron] done: ${izdano} izvjestaja, ${preskoceno} preskoceno, provizija ukupno ${ukupno.toFixed(2)}`
                );
                for (const r of result.reports) {
                    console.log(
                        `[commission-report-cron]   #${r.report_no} ${r.partner_name} ${r.period_from}–${r.period_to} (${r.billing_cycle}) — karata=${r.tickets_count} promet=${r.gross_amount} provizija=${r.commission_amount}`
                    );
                }
                for (const p of result.partners_skipped) {
                    console.log(`[commission-report-cron]   preskocen ${p.partner_name}: ${p.reason}`);
                }
            } catch (err) {
                console.error("[commission-report-cron] FAILED:", err.message);
            }
        },
        { timezone: CRON_TZ }
    );
    console.log(`[commission-report-cron] scheduled "${CRON_EXPR}" (${CRON_TZ})`);
    return task;
}

module.exports = { startPartnerCommissionReportScheduler };
