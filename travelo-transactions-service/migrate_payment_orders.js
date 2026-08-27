// Prijenos SEPA naloga u platne naloge.
//
// Nalozi su prošireni na povrate kartičarskim kućama, pa tablice više nisu
// "sepa_*" nego "payment_*". Nove tablice kreira sync; ovdje se prenose
// postojeći zapisi, s providerom SEPA jer su svi dosadašnji bili povrati na
// račun. Skripta je idempotentna — preskače ono što je već preneseno.
const { syncDatabaseConfigData, getDatabaseConfigData, syncCoreServiceConfigData } = require('./controllers/configSyncController');
const { initSequelize, getSequelize } = require('./config/database');

(async () => {
    await syncCoreServiceConfigData();
    await syncDatabaseConfigData();
    await initSequelize(await getDatabaseConfigData());
    const sq = getSequelize();

    const [postoji] = await sq.query(`SELECT to_regclass('public.sepa_orders') AS t`);
    if (!postoji[0].t) {
        console.log('starih tablica nema — nema se što prenijeti');
        process.exit(0);
    }

    const [nalozi] = await sq.query(`
        INSERT INTO payment_orders (payment_order_uuid, provider, name, status, created_by, closed_at, closed_by, note, "createdAt", "updatedAt")
        SELECT sepa_order_uuid, 'SEPA', name, status, created_by, closed_at, closed_by, note, "createdAt", "updatedAt"
        FROM sepa_orders
        WHERE sepa_order_uuid NOT IN (SELECT payment_order_uuid FROM payment_orders)
        RETURNING payment_order_uuid
    `);
    const [stavke] = await sq.query(`
        INSERT INTO payment_order_items (payment_item_uuid, payment_order_uuid, provider, amount, recipient_name, recipient_iban,
                                         storno_invoice_uuid, storno_invoice_code, ticket_uuids, ticket_codes, description, created_by,
                                         "createdAt", "updatedAt")
        SELECT sepa_item_uuid, sepa_order_uuid, 'SEPA', amount, recipient_name, recipient_iban,
               storno_invoice_uuid, storno_invoice_code, ticket_uuids, ticket_codes, description, created_by,
               "createdAt", "updatedAt"
        FROM sepa_order_items
        WHERE sepa_item_uuid NOT IN (SELECT payment_item_uuid FROM payment_order_items)
        RETURNING payment_item_uuid
    `);
    console.log('preneseno naloga:', nalozi.length, '| stavki:', stavke.length);
    // Stare tablice se namjerno NE brišu — ostaju dok se ne potvrdi da je sve u redu.
    process.exit(0);
})().catch((e) => { console.log('GRESKA', e.message); process.exit(1); });
