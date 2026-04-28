const cron = require("node-cron");
const { generatePartnerInvoices } = require("./dataControllers/partnerInvoiceGeneratorController");

const CRON_EXPR = "*/10 * * * *";
const CRON_TZ = "Europe/Zagreb";

function startPartnerInvoiceScheduler() {
    const task = cron.schedule(
        CRON_EXPR,
        async () => {
            const startedAt = new Date();
            console.log(`[partner-invoice-cron] firing at ${startedAt.toISOString()}`);
            try {
                const result = await generatePartnerInvoices({ asOfDate: startedAt });
                const issued = result.invoices.length;
                const skipped = result.partners_skipped.length;
                const totalNet = result.invoices.reduce(
                    (s, i) => s + (parseFloat(i.net_amount) || 0),
                    0
                );
                console.log(
                    `[partner-invoice-cron] done: ${issued} invoices, ${skipped} skipped, net total ${totalNet.toFixed(2)}`
                );
                for (const inv of result.invoices) {
                    console.log(
                        `[partner-invoice-cron]   #${inv.partner_invoice_no} ${inv.partner_name} — tickets=${inv.tickets_count} gross=${inv.gross_amount} net=${inv.net_amount}`
                    );
                }
            } catch (err) {
                console.error("[partner-invoice-cron] FAILED:", err.message);
            }
        },
        { timezone: CRON_TZ }
    );
    console.log(`[partner-invoice-cron] scheduled "${CRON_EXPR}" (${CRON_TZ})`);
    return task;
}

module.exports = { startPartnerInvoiceScheduler };
