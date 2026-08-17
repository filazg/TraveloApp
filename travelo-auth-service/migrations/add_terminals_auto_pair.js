// auth-service sinkronizira modele s alter:false, pa kolonu dodajemo eksplicitno.
const { Client } = require("C:/Tech4beeZ/Projekti/TraveloApp/travelo-backoffice-service/node_modules/pg");
const cfg = require("C:/Tech4beeZ/Projekti/TraveloApp/travelo-control-service/config/databases_configs.json");
const c = cfg.auth_service;
(async () => {
  const cl = new Client({ host: c.db_host, port: c.db_port, database: c.db_name, user: c.db_username, password: c.db_pass, ssl: { rejectUnauthorized: false } });
  await cl.connect();
  await cl.query(`alter table terminals add column if not exists auto_pair boolean default false`);
  console.log("kolone terminals:", (await cl.query(`select column_name from information_schema.columns where table_name='terminals' order by ordinal_position`)).rows.map(r=>r.column_name).join(", "));
  await cl.end();
})().catch((e) => { console.log("GREŠKA:", e.message); process.exit(1); });
