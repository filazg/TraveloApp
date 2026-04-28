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
    dbConfig.db_name,
    dbConfig.db_username,
    dbConfig.db_pass,
    {
      host: dbConfig.db_host,
      port: dbConfig.db_port,
      dialect: "postgres",
      dialectOptions: {
        decimalNumbers: true,
        ssl: { require: true, rejectUnauthorized: false },
      },
      logging: false,
    }
  );

  const t = await sequelize.transaction();
  try {
    await sequelize.authenticate();

    const invoiceUuids = (
      await sequelize.query(
        `SELECT invoice_uuid FROM invoices WHERE invoice_no IS NULL;`,
        { type: QueryTypes.SELECT, transaction: t }
      )
    ).map((r) => r.invoice_uuid);
    console.log(`target invoices (NULL invoice_no): ${invoiceUuids.length}`);

    if (invoiceUuids.length === 0) {
      await t.commit();
      console.log("nothing to delete");
    } else {
      const itemUuids = (
        await sequelize.query(
          `SELECT item_uuid FROM invoice_items WHERE invoice_uuid IN (:uuids);`,
          {
            type: QueryTypes.SELECT,
            replacements: { uuids: invoiceUuids },
            transaction: t,
          }
        )
      ).map((r) => r.item_uuid);
      console.log(`linked invoice_items: ${itemUuids.length}`);

      let detailsDeleted = 0;
      if (itemUuids.length > 0) {
        const [, meta1] = await sequelize.query(
          `DELETE FROM invoice_item_details WHERE item_uuid IN (:uuids);`,
          {
            replacements: { uuids: itemUuids },
            transaction: t,
          }
        );
        detailsDeleted = meta1.rowCount ?? 0;
      }
      console.log(`deleted invoice_item_details: ${detailsDeleted}`);

      const [, meta2] = await sequelize.query(
        `DELETE FROM invoice_items WHERE invoice_uuid IN (:uuids);`,
        {
          replacements: { uuids: invoiceUuids },
          transaction: t,
        }
      );
      console.log(`deleted invoice_items: ${meta2.rowCount ?? 0}`);

      const [, meta3] = await sequelize.query(
        `DELETE FROM invoices WHERE invoice_uuid IN (:uuids);`,
        {
          replacements: { uuids: invoiceUuids },
          transaction: t,
        }
      );
      console.log(`deleted invoices: ${meta3.rowCount ?? 0}`);

      await t.commit();
    }

    const [{ cnt }] = await sequelize.query(
      `SELECT COUNT(*)::int AS cnt FROM invoices WHERE invoice_no IS NULL;`,
      { type: QueryTypes.SELECT }
    );
    console.log(`remaining NULL invoice_no rows: ${cnt}`);

    if (cnt === 0) {
      await sequelize.query(
        `ALTER TABLE invoices ALTER COLUMN invoice_no SET NOT NULL;`
      );
      console.log("invoice_no -> NOT NULL");
    } else {
      console.warn(`still ${cnt} NULL rows, NOT NULL not applied`);
    }

    console.log("DONE");
  } catch (err) {
    try {
      await t.rollback();
    } catch (_) {}
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
