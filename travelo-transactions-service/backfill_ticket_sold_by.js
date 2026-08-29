// Upisuje korisnicko ime prodavaca na vec prodane karte partnerskog kanala.
//
// Karta je od pocetka imala stupac `sold_by_username`, ali ga sales-service
// nije prosljedivao pri kreiranju — pa je obracun provizije za partnerovu
// vlastitu prodaju pokazivao crticu umjesto osobe. Podatak nije izgubljen:
// stoji na narudzbi (`partner_web_user_username`), pa se karte popunjavaju iz
// nje. Nove prodaje ga nose same.
//
// Pokretanje:  node backfill_ticket_sold_by.js
//              APP_ENV=test_do DB_PASS='...' node backfill_ticket_sold_by.js
//
// Pise samo tamo gdje je prazno — vec upisano ime se ne dira, pa se skripta
// moze pokrenuti vise puta bez posljedica.
const { Sequelize, QueryTypes } = require("sequelize");
const axios = require("axios");
const {
    syncCoreServiceConfigData,
    syncDatabaseConfigData,
    getDatabaseConfigData,
    getCoreServiceConfigData,
} = require("./controllers/configSyncController");

(async () => {
    await syncCoreServiceConfigData();
    await syncDatabaseConfigData();
    const cfg = await getDatabaseConfigData();
    if (!cfg?.db_pass) {
        throw new Error("control-service nije vratio lozinku baze — provjeri DB_PASS u njegovoj okolini");
    }
    const core = await getCoreServiceConfigData();
    const salesUrl = core?.services?.sales?.url;
    if (!salesUrl) throw new Error("u konfiguraciji nema adrese sales-servisa");

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

        // Narudzbe su u drugoj bazi (sales-service), pa se citaju preko njegovog
        // sucelja, a ne upitom preko sheme.
        const resp = await axios.get(`${salesUrl}/orders`, { timeout: 15000 });
        const narudzbe = (resp.data?.data?.orders || resp.data?.orders || [])
            .filter((o) => o.partner_web_user_username);
        console.log(`narudzbi s korisnikom: ${narudzbe.length}`);

        let ukupno = 0;
        for (const o of narudzbe) {
            const [, meta] = await sequelize.query(
                `UPDATE tickets
                    SET sold_by_username = :korisnik
                  WHERE order_uuid = :narudzba
                    AND (sold_by_username IS NULL OR sold_by_username = '')`,
                { replacements: { korisnik: o.partner_web_user_username, narudzba: o.uuid } }
            );
            const koliko = meta?.rowCount || 0;
            if (koliko) console.log(`  PW-${o.id} -> ${o.partner_web_user_username}: ${koliko} karata`);
            ukupno += koliko;
        }

        // API kanal: prodavatelj nije osoba nego partnerov terminal, pa se
        // upisuje njegov TID. Narudzbe su ovdje, u istoj bazi, a TID stoji u
        // backofficeu uz API korisnika.
        const backofficeUrl = core?.services?.backoffice?.url;
        if (backofficeUrl) {
            const apiResp = await axios.get(`${backofficeUrl}/partners_api_users`, { timeout: 15000 });
            const apiKorisnici = apiResp.data?.data?.partners_api_users || apiResp.data?.partners_api_users || [];
            for (const u of apiKorisnici) {
                if (!u.tid || !u.uuid) continue;
                const [, meta] = await sequelize.query(
                    `UPDATE tickets AS t
                        SET sold_by_username = :tid
                       FROM api_orders AS o
                      WHERE t.order_uuid = o.order_uuid
                        AND o.api_user_uuid = :korisnik
                        AND (t.sold_by_username IS NULL OR t.sold_by_username = '')`,
                    { replacements: { tid: u.tid, korisnik: u.uuid } }
                );
                const koliko = meta?.rowCount || 0;
                if (koliko) console.log(`  ${u.tid} (${u.partner_name || ""}): ${koliko} karata`);
                ukupno += koliko;
            }
        }

        const [preostalo] = await sequelize.query(
            `SELECT COUNT(*)::int AS bez_korisnika
               FROM tickets
              WHERE partner_uuid IS NOT NULL
                AND (sold_by_username IS NULL OR sold_by_username = '')`,
            { type: QueryTypes.SELECT }
        );
        console.log(`upisano: ${ukupno} karata; bez korisnika jos: ${preostalo.bez_korisnika}`);
    } finally {
        await sequelize.close();
    }
})().catch((e) => {
    console.error("backfill pukao:", e.message);
    process.exit(1);
});
