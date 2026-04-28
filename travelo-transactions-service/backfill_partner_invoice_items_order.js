const { Sequelize, QueryTypes } = require("sequelize");

const dbConfig = {
  db_name: "travelo-transactions-db",
  db_username: "doadmin",
  db_pass: process.env.DB_PASS,
  db_port: 25060,
  db_host: "kl-t4b-test-db-cluster-do-user-14047342-0.b.db.ondigitalocean.com",
};

(async () => {
  const sequelize = new Sequelize(
    dbConfig.db_name, dbConfig.db_username, dbConfig.db_pass,
    {
      host: dbConfig.db_host, port: dbConfig.db_port, dialect: "postgres",
      dialectOptions: { decimalNumbers: true, ssl: { require: true, rejectUnauthorized: false } },
      logging: false,
    }
  );
  try {
    await sequelize.authenticate();

    const [before] = await sequelize.query(
      `SELECT
         COUNT(*) FILTER (WHERE order_uuid IS NULL)::int AS null_order_uuid,
         COUNT(*) FILTER (WHERE sale_datetime IS NULL)::int AS null_sale_datetime,
         COUNT(*) FILTER (WHERE order_note IS NULL)::int AS null_order_note,
         COUNT(*)::int AS total
       FROM partner_invoice_items;`,
      { type: QueryTypes.SELECT }
    );
    console.log("before:", before);

    await sequelize.query(`
      UPDATE partner_invoice_items pii
      SET order_uuid = t.order_uuid,
          sale_datetime = COALESCE(pii.sale_datetime, t."createdAt"),
          order_note = COALESCE(pii.order_note, t.order_note)
      FROM tickets t
      WHERE t.ticket_uuid = pii.ticket_uuid
        AND (pii.order_uuid IS NULL OR pii.sale_datetime IS NULL);
    `);

    const [after] = await sequelize.query(
      `SELECT
         COUNT(*) FILTER (WHERE order_uuid IS NULL)::int AS null_order_uuid,
         COUNT(*) FILTER (WHERE sale_datetime IS NULL)::int AS null_sale_datetime,
         COUNT(*) FILTER (WHERE order_note IS NULL)::int AS null_order_note,
         COUNT(*)::int AS total
       FROM partner_invoice_items;`,
      { type: QueryTypes.SELECT }
    );
    console.log("after: ", after);

    console.log("DONE");
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
