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

        // Sve timetable-e + brojač departures-a + brojač routesa
        const [tt] = await sequelize.query(`
            SELECT t.id, t.code, t.name, t.is_active,
                   (SELECT COUNT(*) FROM departures d WHERE d.timetable_uuid=t.uuid AND d.is_active=true) AS deps_active,
                   (SELECT COUNT(*) FROM routes r WHERE r.timetable_uuid=t.uuid AND r.is_active=true) AS routes_active
            FROM timetables t WHERE t.is_active=true ORDER BY t.id;
        `);
        console.log("Aktivni timetableovi (s brojem departures + routes):");
        for (const t of tt) console.log(`  #${t.id} ${t.code} (${t.name}) → deps=${t.deps_active} routes=${t.routes_active}`);

        // Detalj za KRILO-SD-MAIN
        const [krilo] = await sequelize.query(`
            SELECT id, uuid, code, name, line_uuid, line_code FROM timetables WHERE code='KRILO-SD-MAIN' LIMIT 1;
        `);
        if (krilo[0]) {
            const k = krilo[0];
            console.log(`\nKRILO-SD-MAIN uuid=${k.uuid}`);
            const [deps] = await sequelize.query(`SELECT departure, departure_harbor_name, arrival, arrival_harbor_name, sequence, harbor_order, is_active FROM departures WHERE timetable_uuid=:u ORDER BY sequence, harbor_order LIMIT 30;`, { replacements: { u: k.uuid } });
            console.log(`Departures (${deps.length}):`);
            for (const d of deps) console.log(`  seq=${d.sequence} ord=${d.harbor_order} ${d.departure_harbor_name} ${d.departure}→${d.arrival} ${d.arrival_harbor_name} active=${d.is_active}`);

            const [routes] = await sequelize.query(`SELECT id, code, departure, arrival, departure_harbor_name, arrival_harbor_name, is_active FROM routes WHERE timetable_uuid=:u ORDER BY id LIMIT 30;`, { replacements: { u: k.uuid } });
            console.log(`\nRoutes (${routes.length}):`);
            for (const r of routes) console.log(`  ${r.code} ${r.departure_harbor_name} ${r.departure}→${r.arrival} ${r.arrival_harbor_name} active=${r.is_active}`);
        }
    } catch (err) {
        console.error("FAILED:", err.message);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
})();
