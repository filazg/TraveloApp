// Prodavatelj na stavci partnerskog racuna.
//
// Racun pokazuje sto je prodano, ali ne i tko je prodao — a partner svoje ljude
// placa i prati po tome. Podatak stoji na karti (`tickets.sold_by_username`:
// korisnik partnerske prodaje ili TID terminala kod API prodaje), pa se prepise
// na stavku racuna da racun i kasnije stoji sam za sebe.
//
// Pokretanje:  node migrate_partner_invoice_item_seller.js
//              APP_ENV=test_do DB_PASS='...' node migrate_partner_invoice_item_seller.js
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
        await sequelize.query(
            `ALTER TABLE partner_invoice_items ADD COLUMN IF NOT EXISTS sold_by_username VARCHAR(255) NULL;`
        );
        console.log("partner_invoice_items.sold_by_username spreman");

        const [, meta] = await sequelize.query(
            `UPDATE partner_invoice_items AS s
                SET sold_by_username = k.sold_by_username
               FROM tickets AS k
              WHERE k.ticket_uuid = s.ticket_uuid
                AND s.sold_by_username IS NULL
                AND k.sold_by_username IS NOT NULL`
        );
        console.log(`stavkama upisan prodavatelj: ${meta?.rowCount || 0}`);

        const razrada = await sequelize.query(
            `SELECT COALESCE(sold_by_username, '—') AS prodavatelj, COUNT(*)::int AS karata
               FROM partner_invoice_items
              GROUP BY 1 ORDER BY 2 DESC`,
            { type: QueryTypes.SELECT }
        );
        for (const r of razrada) console.log(`  ${r.prodavatelj}: ${r.karata} karata`);
    } finally {
        await sequelize.close();
    }
})().catch((e) => {
    console.error("migracija pukla:", e.message);
    process.exit(1);
});
