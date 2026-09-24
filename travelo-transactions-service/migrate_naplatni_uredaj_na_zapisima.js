// Naplatni uredaj uz zapise: karta, validacija, greska s karticom.
//
// Karta dosad uopce nije nosila uredaj — s koje je blagajne izasla saznavalo se
// samo preko racuna, a karte iz drugih kanala racun ni nemaju. Validacija i
// greska s karticom nosile su samo uuid, koji u pregledu nikome nista ne znaci.
//
// Uz uuid sada idu i broj (TID) i naziv, onako kako uredaj pise na svom ekranu.
// Zatecene zapise puni iz sifarnika backofficea, koliko se moze povezati.
// Idempotentno (IF NOT EXISTS), pa se smije pokrenuti vise puta.
const { syncDatabaseConfigData, getDatabaseConfigData, syncCoreServiceConfigData } = require("./controllers/configSyncController");
const { initSequelize, getSequelize } = require("./config/database");
const { dohvatiUredaje } = require("./helpers/naplatniUredaj");

(async () => {
    await syncDatabaseConfigData();
    await syncCoreServiceConfigData();
    await initSequelize(await getDatabaseConfigData());
    const sequelize = getSequelize();

    const stupci = [
        ["tickets", "billing_device_uuid"],
        ["tickets", "billing_device_tid"],
        ["tickets", "billing_device_name"],
        ["ticket_validations", "terminal_tid"],
        ["ticket_validations", "terminal_name"],
        ["seop_greske_kartica", "terminal_tid"],
        ["seop_greske_kartica", "terminal_name"],
    ];
    for (const [tablica, stupac] of stupci) {
        await sequelize.query(`ALTER TABLE ${tablica} ADD COLUMN IF NOT EXISTS ${stupac} varchar(255)`);
    }
    console.log(`  · stupci (${stupci.length})`);

    // Karta se veze na uredaj preko racuna — to je jedini trag koji zatecene
    // karte imaju.
    await sequelize.query(`
        UPDATE tickets t
        SET billing_device_uuid = i.invoice_billing_device_uuid
        FROM invoices i
        WHERE t.invoice_uuid = i.invoice_uuid
          AND t.billing_device_uuid IS NULL
          AND i.invoice_billing_device_uuid IS NOT NULL
    `);
    console.log("  · karte povezane s uredajem preko racuna");

    // Broj i naziv dolaze iz sifarnika; ako backoffice ne odgovori, zapisi
    // ostaju s uuid-om i popuna se moze ponoviti kasnije.
    let uredaji = [];
    try {
        uredaji = await dohvatiUredaje();
    } catch (e) {
        console.log("  ! sifarnik uredaja nije dostupan:", e?.message || e);
    }
    console.log(`  · uredaja u sifarniku: ${uredaji.length}`);

    for (const u of uredaji) {
        const zamjene = { uuid: u.uuid, tid: u.tid || null, naziv: u.name || null };
        await sequelize.query(
            `UPDATE tickets SET billing_device_tid = :tid, billing_device_name = :naziv
             WHERE billing_device_uuid = :uuid AND billing_device_tid IS NULL`,
            { replacements: zamjene }
        );
        await sequelize.query(
            `UPDATE ticket_validations SET terminal_tid = :tid, terminal_name = :naziv
             WHERE terminal_uuid = :uuid AND terminal_tid IS NULL`,
            { replacements: zamjene }
        );
        await sequelize.query(
            `UPDATE seop_greske_kartica SET terminal_tid = :tid, terminal_name = :naziv
             WHERE terminal_uuid = :uuid AND terminal_tid IS NULL`,
            { replacements: zamjene }
        );
    }

    const [[stanje]] = await sequelize.query(`
        SELECT
            (SELECT count(*)::int FROM tickets WHERE billing_device_tid IS NOT NULL) AS karte,
            (SELECT count(*)::int FROM tickets WHERE billing_device_uuid IS NULL) AS karte_bez,
            (SELECT count(*)::int FROM ticket_validations WHERE terminal_tid IS NOT NULL) AS validacije,
            (SELECT count(*)::int FROM seop_greske_kartica WHERE terminal_tid IS NOT NULL) AS greske
    `);
    console.log(`  · karata s brojem uredaja: ${stanje.karte} (bez veze na uredaj: ${stanje.karte_bez})`);
    console.log(`  · validacija: ${stanje.validacije}, gresaka s karticom: ${stanje.greske}`);

    console.log("\n✓ migracija naplatnog uredaja na zapisima gotova");
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
