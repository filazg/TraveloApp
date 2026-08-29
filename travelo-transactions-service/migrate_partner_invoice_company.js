// Dodaje podatke izdavatelja na partnerski racun.
//
// Racun mora sam nositi tko ga je izdao — podaci tvrtke se s vremenom mijenjaju,
// a vec izdani racun se ne smije mijenjati zajedno s njima. Dosad su se
// partnerski racuni prikazivali bez zaglavlja izdavatelja, za razliku od svih
// ostalih racuna u sustavu.
//
// Pokretanje:  node migrate_partner_invoice_company.js
//              APP_ENV=test_do DB_PASS='...' node migrate_partner_invoice_company.js
const { Sequelize, QueryTypes } = require("sequelize");
const axios = require("axios");
const {
    syncCoreServiceConfigData,
    syncDatabaseConfigData,
    getDatabaseConfigData,
    getCoreServiceConfigData,
} = require("./controllers/configSyncController");

const STUPCI = {
    company_name: "name",
    company_address: "address",
    company_postal_code: "postal_code",
    company_town: "town",
    company_legal_id: "legal_id",
    company_iban: "iban",
};

(async () => {
    await syncCoreServiceConfigData();
    await syncDatabaseConfigData();
    const cfg = await getDatabaseConfigData();
    if (!cfg?.db_pass) {
        throw new Error("control-service nije vratio lozinku baze — provjeri DB_PASS u njegovoj okolini");
    }
    const core = await getCoreServiceConfigData();
    const boUrl = core?.services?.backoffice?.url;

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
        for (const stupac of Object.keys(STUPCI)) {
            await sequelize.query(
                `ALTER TABLE partner_invoices ADD COLUMN IF NOT EXISTS ${stupac} VARCHAR(255) NULL;`
            );
        }
        console.log("stupci izdavatelja spremni");

        // Stari racuni: upisuje se danasnja tvrtka, jer druge snimke nema.
        if (boUrl) {
            const resp = await axios.get(`${boUrl}/company`, { timeout: 15000 });
            const tvrtka = resp.data?.data?.company || {};
            if (tvrtka.name) {
                const postavke = Object.entries(STUPCI)
                    .map(([stupac], i) => `${stupac} = $${i + 1}`)
                    .join(", ");
                const vrijednosti = Object.values(STUPCI).map((k) => tvrtka[k] || null);
                const [, meta] = await sequelize.query(
                    `UPDATE partner_invoices SET ${postavke} WHERE company_name IS NULL`,
                    { bind: vrijednosti }
                );
                console.log(`starim racunima upisan izdavatelj (${tvrtka.name}): ${meta?.rowCount || 0}`);
            }
        } else {
            console.log("nema adrese backofficea — stari racuni ostaju bez izdavatelja");
        }

        const [provjera] = await sequelize.query(
            `SELECT COUNT(*)::int AS racuna, COUNT(*) FILTER (WHERE company_name IS NULL)::int AS bez_izdavatelja
               FROM partner_invoices`,
            { type: QueryTypes.SELECT }
        );
        console.log(`racuna: ${provjera.racuna}, bez izdavatelja: ${provjera.bez_izdavatelja}`);
    } finally {
        await sequelize.close();
    }
})().catch((e) => {
    console.error("migracija pukla:", e.message);
    process.exit(1);
});
