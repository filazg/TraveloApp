// partner_invoices: kolone za kontekst izdavanja (transactions servis sinkronizira
// modele s alter:false, pa ih dodajemo eksplicitno). Idempotentno.
const { Client } = require("C:/Tech4beeZ/Projekti/TraveloApp/travelo-backoffice-service/node_modules/pg");
const cfg = require("C:/Tech4beeZ/Projekti/TraveloApp/travelo-control-service/config/databases_configs.json");
const c = cfg.transactions_service;
const COLS = [
  "business_premise_uuid", "business_premise_name", "business_premise_fiscal_mark",
  "billing_device_uuid", "billing_device_fiscal_mark",
  "payment_method_uuid", "payment_method_name", "cost_center",
];
(async () => {
  const cl = new Client({ host: c.db_host, port: c.db_port, database: c.db_name, user: c.db_username, password: c.db_pass, ssl: { rejectUnauthorized: false } });
  await cl.connect();
  for (const col of COLS) {
    await cl.query(`alter table partner_invoices add column if not exists "${col}" varchar(255)`);
  }
  const have = (await cl.query(
    `select column_name from information_schema.columns
     where table_name='partner_invoices' and column_name = any($1) order by column_name`, [COLS])).rows.map(r => r.column_name);
  console.log(`dodano/postoji ${have.length}/${COLS.length}:`, have.join(", "));
  await cl.end();
})().catch((e) => { console.log("GREŠKA:", e.message); process.exit(1); });
