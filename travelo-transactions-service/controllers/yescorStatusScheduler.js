const cron = require("node-cron");
const { pollPendingInvoices } = require("./integrations/yescorStatusPoller");
const { prijaviNaplate, osvjeziNaplate } = require("./integrations/yescorNaplata");
const { getModels } = require("../dbModels");

const CRON_EXPR = "*/30 * * * * *"; // svakih 30s
const CRON_TZ = "Europe/Zagreb";

function startYescorStatusScheduler() {
    let running = false;
    const task = cron.schedule(
        CRON_EXPR,
        async () => {
            if (running) return; // preskoči ako prethodni još traje
            running = true;
            try {
                const models = getModels();
                if (!models?.InvoiceModel) return;
                const result = await pollPendingInvoices(models);
                if (result.checked > 0) {
                    console.log(`[yescor-status-cron] checked=${result.checked} updated=${result.updated}`);
                }
                // Naplata ide nakon statusa — tek fiskaliziran racun smije
                // dobiti prijavu naplate, pa racun fiskaliziran u ovom krugu
                // odmah ide dalje.
                const naplata = await prijaviNaplate(models);
                if (naplata.kandidata > 0) {
                    console.log(`[yescor-status-cron] naplata prijavljeno=${naplata.prijavljeno}/${naplata.kandidata}`);
                }
                await osvjeziNaplate(models);
            } catch (err) {
                console.error("[yescor-status-cron] FAILED:", err.message);
            } finally {
                running = false;
            }
        },
        { timezone: CRON_TZ }
    );
    console.log(`[yescor-status-cron] scheduled "${CRON_EXPR}" (${CRON_TZ})`);
    return task;
}

module.exports = { startYescorStatusScheduler };
