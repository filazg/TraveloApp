// Dodaje stupce za prebacivanje karte na drugi polazak i vezu karte na racun.
//
// Transactions servis se diže sa `sync({ alter: false })`, pa novi stupci iz
// modela NE nastaju sami — dok migracija ne prođe, Sequelize ih traži u svakom
// upitu i pregled karata puca s "column ... does not exist".
//
// Pokretanje:  node migrate_ticket_transfer_fields.js
const { Sequelize } = require("sequelize");
const cfg = require("../travelo-control-service/config/databases_configs.json").transactions_service;

(async () => {
    const sequelize = new Sequelize(cfg.db_name, cfg.db_username, cfg.db_pass, {
        host: cfg.db_host,
        port: cfg.db_port,
        dialect: "postgres",
        dialectOptions: { decimalNumbers: true, ssl: { require: true, rejectUnauthorized: false } },
        logging: false,
    });
    try {
        await sequelize.authenticate();
        await sequelize.query(`
            ALTER TABLE tickets
                ADD COLUMN IF NOT EXISTS invoice_uuid                 VARCHAR(255),
                ADD COLUMN IF NOT EXISTS transferred_to_ticket_uuid   VARCHAR(255),
                ADD COLUMN IF NOT EXISTS transferred_from_ticket_uuid VARCHAR(255),
                ADD COLUMN IF NOT EXISTS transfer_percentage          DOUBLE PRECISION,
                ADD COLUMN IF NOT EXISTS transfer_credit              DOUBLE PRECISION;
        `);
        const [stupci] = await sequelize.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'tickets' AND (column_name LIKE 'transfer%' OR column_name = 'invoice_uuid')
            ORDER BY column_name
        `);
        console.log("tickets — stupci za promjenu karte:", stupci.map((c) => c.column_name).join(", "));
    } catch (err) {
        console.error("NEUSPJELO:", err.message);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
})();
