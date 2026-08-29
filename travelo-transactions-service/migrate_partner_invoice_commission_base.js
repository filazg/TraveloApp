// Dodaje osnovicu za proviziju na partnerski racun i njegove stavke.
//
// Provizija se racuna na iznos bez lucke pristojbe i bez PDV-a, pa se ta
// osnovica mora i vidjeti na racunu — inace se postotak i iznos provizije ne
// mogu sloziti, jer na bruto iznos ne daju taj rezultat.
//
// Transactions servis se dize sa `sync({ alter: false })`, pa novi stupci iz
// modela NE nastaju sami — dok migracija ne prode, Sequelize ih trazi u svakom
// upitu i pregled partnerskih racuna puca s "column ... does not exist".
//
// Pokretanje:  node migrate_partner_invoice_commission_base.js
//              APP_ENV=test_do DB_PASS='...' node migrate_partner_invoice_commission_base.js
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
                 ADD COLUMN IF NOT EXISTS commission_base NUMERIC(12,2) NOT NULL DEFAULT 0;`
            );
            console.log(`${tablica}.commission_base spreman`);
        }

        // Stari racuni: osnovica se izvodi iz bruta po istom pravilu (pristojba
        // 6 %, PDV 25 %). Iznos provizije se NE dira — on je vec ispostavljen i
        // naplacuje se onakav kakav je izdan.
        const [, meta] = await sequelize.query(
            `UPDATE partner_invoices
                SET commission_base = ROUND((gross_amount - ROUND(gross_amount * 0.06, 2)) / 1.25, 2)
              WHERE commission_base = 0 AND gross_amount > 0`
        );
        console.log(`starim racunima upisana osnovica: ${meta?.rowCount || 0}`);

        const [, metaS] = await sequelize.query(
            `UPDATE partner_invoice_items
                SET commission_base = ROUND((gross_amount - ROUND(gross_amount * 0.06, 2)) / 1.25, 2)
              WHERE commission_base = 0 AND gross_amount > 0`
        );
        console.log(`starim stavkama upisana osnovica: ${metaS?.rowCount || 0}`);

        const [provjera] = await sequelize.query(
            `SELECT COUNT(*)::int AS racuna,
                    COUNT(*) FILTER (WHERE commission_base = 0)::int AS bez_osnovice
               FROM partner_invoices`,
            { type: QueryTypes.SELECT }
        );
        console.log(`racuna: ${provjera.racuna}, bez osnovice: ${provjera.bez_osnovice}`);
    } finally {
        await sequelize.close();
    }
})().catch((e) => {
    console.error("migracija pukla:", e.message);
    process.exit(1);
});
