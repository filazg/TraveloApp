// Seed otočne karte za testiranje SEOP flow-a:
// 1) Otočnoj karti pridijeli SEOP namjenu OOA i posudi booking_type od "Putnik".
// 2) Za timetable KRILO-SD-MAIN dodaj otočnu cijenu (5.00 EUR) u svaku relaciju.
// Idempotentno — ako redak već postoji, samo update price.
const { Sequelize } = require("sequelize");
const crypto = require("crypto");

const dbConfig = {
    db_name: "travelo-boat-db",
    db_username: "doadmin",
    db_pass: process.env.DB_PASS,
    db_port: 25060,
    db_host: "kl-t4b-test-db-cluster-do-user-14047342-0.b.db.ondigitalocean.com",
};

const ISLAND_PRICE = 5.00;
const TIMETABLE_CODE = "KRILO-SD-MAIN";

(async () => {
    const sequelize = new Sequelize(dbConfig.db_name, dbConfig.db_username, dbConfig.db_pass, {
        host: dbConfig.db_host, port: dbConfig.db_port, dialect: "postgres",
        dialectOptions: { decimalNumbers: true, ssl: { require: true, rejectUnauthorized: false } },
        logging: false,
    });
    try {
        await sequelize.authenticate();

        // 1) Pridijeli OOA + booking_type od "Putnik" otočnoj karti.
        const [putnik] = await sequelize.query(`SELECT booking_type_uuid, booking_type_acr FROM tickets_types WHERE name='Putnik' LIMIT 1;`);
        const bt = putnik[0] || {};
        await sequelize.query(
            `UPDATE tickets_types SET seop_type=:seop, booking_type_uuid=:btu, booking_type_acr=:bta WHERE name='Otočna karta';`,
            { replacements: { seop: 'OOA', btu: bt.booking_type_uuid || null, bta: bt.booking_type_acr || 'BAS' } }
        );
        console.log(`[1/3] Otočna karta: seop_type=OOA, booking_type_acr=${bt.booking_type_acr || 'BAS'}`);

        // 2) Dohvati otočnu vrstu i timetable.
        const [islandTypeRows] = await sequelize.query(`SELECT id, uuid, name, name_eng, seop_type, booking_type_uuid, booking_type_acr FROM tickets_types WHERE name='Otočna karta' AND is_active=true LIMIT 1;`);
        const islandType = islandTypeRows[0];
        if (!islandType) throw new Error("Nema aktivne 'Otočna karta' vrste!");

        const [ttRows] = await sequelize.query(`SELECT id, uuid, code FROM timetables WHERE code=:code AND is_active=true LIMIT 1;`, { replacements: { code: TIMETABLE_CODE } });
        const tt = ttRows[0];
        if (!tt) throw new Error(`Nema aktivnog timetable-a ${TIMETABLE_CODE}`);
        console.log(`[2/3] Timetable ${tt.code} (uuid=${tt.uuid.slice(0,8)}...)`);

        // 3) Za svaku DISTINCT relaciju u tom timetable-u (uzmi iz već postojećih cijena),
        //    upiši otočnu cijenu 5.00. Ako već postoji - update.
        const [pairs] = await sequelize.query(
            `SELECT DISTINCT ON (harbor_from_code, harbor_to_code)
                harbor_from, harbor_from_code, harbor_from_uuid,
                harbor_to, harbor_to_code, harbor_to_uuid,
                vat_uuid, vat_rate, vat_name
             FROM timetable_prices
             WHERE timetable_uuid = :ttUuid AND is_active = true;`,
            { replacements: { ttUuid: tt.uuid } }
        );
        if (!pairs.length) throw new Error(`Timetable ${TIMETABLE_CODE} nema postojeće cijene — dodaj prvo neku obič. cijenu kroz portal.`);

        const price = ISLAND_PRICE;
        const portTax = +(price * 0.06).toFixed(2);
        const net = price - portTax;
        const vatBase = +(net / 1.25).toFixed(2);
        const vatAmount = +(net - vatBase).toFixed(2);

        let inserted = 0, updated = 0;
        for (const p of pairs) {
            const [existing] = await sequelize.query(
                `SELECT id FROM timetable_prices
                 WHERE timetable_uuid = :ttUuid AND ticket_type_uuid = :ttypeUuid
                       AND harbor_from_code = :hfc AND harbor_to_code = :htc
                       AND is_active = true LIMIT 1;`,
                { replacements: { ttUuid: tt.uuid, ttypeUuid: islandType.uuid, hfc: p.harbor_from_code, htc: p.harbor_to_code } }
            );
            if (existing[0]) {
                await sequelize.query(
                    `UPDATE timetable_prices SET price=:price, vat_base=:vb, vat_amount=:va, port_tax=:pt, is_island=true, seop_type=:seop WHERE id=:id;`,
                    { replacements: { id: existing[0].id, price, vb: vatBase, va: vatAmount, pt: portTax, seop: islandType.seop_type } }
                );
                updated++;
            } else {
                await sequelize.query(
                    `INSERT INTO timetable_prices (
                        uuid, timetable_uuid,
                        harbor_from, harbor_from_code, harbor_from_uuid,
                        harbor_to, harbor_to_code, harbor_to_uuid,
                        vat_uuid, vat_rate, vat_name,
                        ticket_type_uuid, ticket_type_name, ticket_type_name_eng,
                        seop_type, is_island,
                        price, vat_base, vat_amount, port_tax,
                        is_active, "createdAt", "updatedAt"
                     ) VALUES (
                        :uuid, :ttUuid,
                        :hf, :hfc, :hfu,
                        :ht, :htc, :htu,
                        :vu, :vr, :vn,
                        :ttypeUuid, :ttypeName, :ttypeEng,
                        :seop, true,
                        :price, :vb, :va, :pt,
                        true, NOW(), NOW()
                     );`,
                    { replacements: {
                        uuid: crypto.randomUUID(), ttUuid: tt.uuid,
                        hf: p.harbor_from, hfc: p.harbor_from_code, hfu: p.harbor_from_uuid,
                        ht: p.harbor_to, htc: p.harbor_to_code, htu: p.harbor_to_uuid,
                        vu: p.vat_uuid, vr: p.vat_rate, vn: p.vat_name,
                        ttypeUuid: islandType.uuid, ttypeName: islandType.name, ttypeEng: islandType.name_eng,
                        seop: islandType.seop_type,
                        price, vb: vatBase, va: vatAmount, pt: portTax,
                    }}
                );
                inserted++;
            }
        }
        console.log(`[3/3] Cijene postavljene: ${inserted} novih, ${updated} ažuriranih (${ISLAND_PRICE} EUR po relaciji).`);

        // Sažetak
        const [final] = await sequelize.query(
            `SELECT harbor_from_code || '→' || harbor_to_code AS rel, price, ticket_type_name FROM timetable_prices
             WHERE timetable_uuid=:ttUuid AND is_island=true AND is_active=true ORDER BY harbor_from_code;`,
            { replacements: { ttUuid: tt.uuid } }
        );
        console.log("\nSada postoji u cjeniku:");
        for (const r of final) console.log(`  ${r.rel}: ${r.price} EUR (${r.ticket_type_name})`);
    } catch (err) {
        console.error("FAILED:", err.message);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
})();
