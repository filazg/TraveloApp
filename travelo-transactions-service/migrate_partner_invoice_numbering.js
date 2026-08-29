// Numeracija partnerskih racuna po pravilu blagajne i mobilne.
//
// Do sada je racun imao samo redni broj po godini. Sada nosi i fiskalni broj i
// vidljivu oznaku, po istom pravilu kao svaki drugi nas racun:
//   • partner_invoice_no       — tece kontinuirano za F1 i F2
//   • partner_invoice_fiskal_no — sekvenca samo za F1; F2 je NULL i ne trosi je
//   • partner_invoice_code     — "fiskalni_broj/PP/NU" za F1, kod za F2
//
// Postojeci racuni su svi F1 (F2 se dosad nije izdavao), pa im fiskalni broj
// prati redni, a oznaka se slaze iz fiskalnih oznaka zapisanih na racunu.
//
// Pokretanje:  node migrate_partner_invoice_numbering.js
//              APP_ENV=test_do DB_PASS='...' node migrate_partner_invoice_numbering.js
const { Sequelize, QueryTypes } = require("sequelize");
const { syncCoreServiceConfigData, syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");

(async () => {
    await syncCoreServiceConfigData();
    await syncDatabaseConfigData();
    const cfg = await getDatabaseConfigData();
    if (!cfg?.db_pass) {
        throw new Error("control-service nije vratio lozinku baze — provjeri DB_PASS u njegovoj okolini");
    }
    console.log(`baza: ${cfg.db_name} @ ${cfg.db_host}`);
    const sequelize = new Sequelize(cfg.db_name, cfg.db_username, cfg.db_pass, {
        host: cfg.db_host,
        port: cfg.db_port,
        dialect: "postgres",
        dialectOptions: { decimalNumbers: true, ssl: { require: true, rejectUnauthorized: false } },
        logging: false,
    });

    try {
        await sequelize.authenticate();
        await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS partner_invoice_fiskal_no INTEGER NULL;`);
        await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS partner_invoice_code VARCHAR(255) NULL;`);
        await sequelize.query(`ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS is_f2 BOOLEAN NOT NULL DEFAULT false;`);
        console.log("stupci numeracije spremni");

        const [, mFiskal] = await sequelize.query(
            `UPDATE partner_invoices
                SET partner_invoice_fiskal_no = partner_invoice_no
              WHERE partner_invoice_fiskal_no IS NULL AND is_f2 = false`
        );
        console.log(`fiskalni broj upisan: ${mFiskal?.rowCount || 0}`);

        const [, mKod] = await sequelize.query(
            `UPDATE partner_invoices
                SET partner_invoice_code = partner_invoice_fiskal_no || '/' || business_premise_fiscal_mark || '/' || billing_device_fiscal_mark
              WHERE partner_invoice_code IS NULL
                AND partner_invoice_fiskal_no IS NOT NULL
                AND business_premise_fiscal_mark IS NOT NULL
                AND billing_device_fiscal_mark IS NOT NULL`
        );
        console.log(`oznaka racuna upisana: ${mKod?.rowCount || 0}`);

        const provjera = await sequelize.query(
            `SELECT partner_invoice_no, partner_invoice_fiskal_no, partner_invoice_code, is_f2, partner_name
               FROM partner_invoices ORDER BY partner_invoice_no`,
            { type: QueryTypes.SELECT }
        );
        for (const r of provjera) {
            console.log(`  br ${r.partner_invoice_no} | fisk ${r.partner_invoice_fiskal_no ?? "—"} | ${r.partner_invoice_code || "—"} | ${r.is_f2 ? "F2" : "F1"} | ${r.partner_name}`);
        }
    } finally {
        await sequelize.close();
    }
})().catch((e) => {
    console.error("migracija pukla:", e.message);
    process.exit(1);
});
