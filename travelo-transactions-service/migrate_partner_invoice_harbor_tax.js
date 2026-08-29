// Dodaje lucku pristojbu na partnerski racun i njegove stavke.
//
// Pristojba je sadrzana u naplacenom iznosu, ali nije nas prihod — prosljeduje
// se luci. Partneru se fakturira u cijelosti i ne umanjuje se za proviziju, pa
// se mora vidjeti izdvojeno: inace se s racuna ne moze procitati koliko je od
// naplacenog iznosa tuda stavka.
//
// Transactions servis se dize sa `sync({ alter: false })`, pa novi stupci iz
// modela NE nastaju sami.
//
// Pokretanje:  node migrate_partner_invoice_harbor_tax.js
//              APP_ENV=test_do DB_PASS='...' node migrate_partner_invoice_harbor_tax.js
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
        for (const tablica of ["partner_invoices", "partner_invoice_items"]) {
            await sequelize.query(
                `ALTER TABLE ${tablica}
                 ADD COLUMN IF NOT EXISTS harbor_tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0;`
            );
            console.log(`${tablica}.harbor_tax_amount spreman`);
        }

        // Stavke: pristojba je 6 % cijene karte, kao i pri prodaji.
        const [, metaS] = await sequelize.query(
            `UPDATE partner_invoice_items
                SET harbor_tax_amount = ROUND(gross_amount * 0.06, 2)
              WHERE harbor_tax_amount = 0 AND gross_amount > 0`
        );
        console.log(`starim stavkama upisana pristojba: ${metaS?.rowCount || 0}`);

        // Zaglavlje: zbroj svojih stavaka, da racun stima sam sa sobom. Racun
        // bez stavaka (ako takvog ima) racuna se iz bruta.
        const [, meta] = await sequelize.query(
            `UPDATE partner_invoices AS r
                SET harbor_tax_amount = COALESCE(
                    (SELECT SUM(s.harbor_tax_amount)
                       FROM partner_invoice_items AS s
                      WHERE s.partner_invoice_uuid = r.partner_invoice_uuid),
                    ROUND(r.gross_amount * 0.06, 2))
              WHERE r.harbor_tax_amount = 0 AND r.gross_amount > 0`
        );
        console.log(`starim racunima upisana pristojba: ${meta?.rowCount || 0}`);

        const provjera = await sequelize.query(
            `SELECT partner_invoice_no, gross_amount, harbor_tax_amount, commission_base, commission_amount
               FROM partner_invoices ORDER BY partner_invoice_no`,
            { type: QueryTypes.SELECT }
        );
        for (const r of provjera) {
            console.log(`  br ${r.partner_invoice_no}: bruto ${r.gross_amount}, pristojba ${r.harbor_tax_amount}, osnovica ${r.commission_base}, provizija ${r.commission_amount}`);
        }
    } finally {
        await sequelize.close();
    }
})().catch((e) => {
    console.error("migracija pukla:", e.message);
    process.exit(1);
});
