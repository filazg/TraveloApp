// Dijagnostička skripta — pokazuje stanje setup-a otočne karte u bazi.
const { Sequelize } = require("sequelize");

const dbConfig = {
    db_name: "travelo-boat-db",
    db_username: "doadmin",
    db_pass: process.env.DB_PASS,
    db_port: 25060,
    db_host: "kl-t4b-test-db-cluster-do-user-14047342-0.b.db.ondigitalocean.com",
};

(async () => {
    const sequelize = new Sequelize(dbConfig.db_name, dbConfig.db_username, dbConfig.db_pass, {
        host: dbConfig.db_host, port: dbConfig.db_port, dialect: "postgres",
        dialectOptions: { decimalNumbers: true, ssl: { require: true, rejectUnauthorized: false } },
        logging: false,
    });
    try {
        await sequelize.authenticate();
        const [islandTypes] = await sequelize.query(`SELECT id, uuid, name, seop_type, is_island, booking_type_uuid, booking_type_acr, is_active FROM tickets_types WHERE is_island = true ORDER BY id;`);
        console.log("OTOČNI tipovi karata:", islandTypes);

        const [allTypes] = await sequelize.query(`SELECT id, uuid, name, seop_type, is_island, booking_type_uuid, booking_type_acr, is_active FROM tickets_types ORDER BY id;`);
        console.log("\nSVI tipovi (sažetak):");
        for (const t of allTypes) console.log(`  #${t.id} ${t.name} | seop=${t.seop_type} island=${t.is_island} bt_acr=${t.booking_type_acr} active=${t.is_active}`);

        const [tcols] = await sequelize.query(`SELECT column_name FROM information_schema.columns WHERE table_name='timetables' ORDER BY ordinal_position;`);
        console.log("\nKolone tablice timetables:", tcols.map(c=>c.column_name).join(", "));

        const [timetables] = await sequelize.query(`SELECT id, uuid, code, name, line_uuid, line_code, line_name, is_active FROM timetables WHERE is_active=true ORDER BY id LIMIT 5;`);
        console.log("\nAKTIVNI timetableovi (top 5):");
        for (const t of timetables) console.log(`  #${t.id} ${t.code} (${t.line_code}/${t.line_name}) uuid=${t.uuid?.slice(0,8)}...`);

        if (timetables.length) {
            const tt = timetables[0];
            const [pairs] = await sequelize.query(
                `SELECT DISTINCT harbor_from, harbor_from_code, harbor_to, harbor_to_code, vat_uuid, vat_rate, vat_name FROM timetable_prices WHERE timetable_uuid = :uuid AND is_active = true LIMIT 10;`,
                { replacements: { uuid: tt.uuid } }
            );
            console.log(`\nRELACIJE u timetableu #${tt.id} (${tt.code}):`);
            for (const p of pairs) console.log(`  ${p.harbor_from_code} (${p.harbor_from}) → ${p.harbor_to_code} (${p.harbor_to}) | VAT ${p.vat_rate}`);

            const [existingIsland] = await sequelize.query(
                `SELECT id, harbor_from_code, harbor_to_code, ticket_type_name, price, is_island FROM timetable_prices WHERE timetable_uuid = :uuid AND is_island = true;`,
                { replacements: { uuid: tt.uuid } }
            );
            console.log(`\nPostojeći OTOČNI cjenici u timetableu #${tt.id}: ${existingIsland.length}`);
            for (const e of existingIsland) console.log(`  ${e.harbor_from_code}→${e.harbor_to_code} ${e.ticket_type_name} = ${e.price}`);
        }
    } catch (err) {
        console.error("FAILED:", err.message);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
})();
