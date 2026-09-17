// is_active migration na sve baze koje hostaju harbors master/snapshote
const { Sequelize } = require("sequelize");

const COMMON = {
    db_username: "doadmin",
    db_pass: process.env.DB_PASS,
    db_port: 25060,
    db_host: "kl-t4b-test-db-cluster-do-user-14047342-0.b.db.ondigitalocean.com",
};

const TARGETS = [
    { db_name: "travelo-boat-db", tables: ["harbors"] },
    { db_name: "travelo-sales-db", tables: ["harbors"] },
    { db_name: "travelo-web-sales-db", tables: ["harbors"] },
];

(async () => {
    for (const tgt of TARGETS) {
        const seq = new Sequelize(tgt.db_name, COMMON.db_username, COMMON.db_pass, {
            host: COMMON.db_host, port: COMMON.db_port, dialect: "postgres",
            dialectOptions: { decimalNumbers: true, ssl: { require: true, rejectUnauthorized: false } },
            logging: false,
        });
        try {
            await seq.authenticate();
            for (const t of tgt.tables) {
                await seq.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`);
                console.log(`  ${tgt.db_name}.${t}.is_active ✓`);
            }
        } catch (e) {
            console.error(`  ${tgt.db_name} FAILED: ${e.message}`);
        } finally {
            await seq.close();
        }
    }
})();
