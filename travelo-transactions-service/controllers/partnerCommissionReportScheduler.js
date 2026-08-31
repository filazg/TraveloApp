const cron = require("node-cron");
const {
    generatePartnerCommissionReports,
} = require("./dataControllers/partnerCommissionReportGeneratorController");

// Razdoblja po dinamici partnera zatvaraju se na granici dana, pa se izvjestaji
// rade jednom nocu. Cesce nema smisla: generator ionako preskace razdoblje koje
// je vec obradeno, a dok se tekuce ne zatvori nema sto novo zapisati.
//
// 00:05 a ne 00:00 — da prodaja s kraja dana sigurno legne prije nego se
// razdoblje zakljuci.
const CRON_EXPR = "5 0 * * *";
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
