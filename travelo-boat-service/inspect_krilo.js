// Quick inspection script — lists harbors, lines, timetables currently in DB.
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize } = require("./config/database");
const { initModels } = require("./dbModels");

(async () => {
    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const models = initModels();
    const { HarborsModel, LinesModel, TimetablesModel, DeparturesModel } = models;

    const harbors = await HarborsModel.findAll({ attributes: ["uuid", "code", "name", "city", "country"] });
    const lines = await LinesModel.findAll({ attributes: ["uuid", "code", "name", "is_active"] });
    const timetables = await TimetablesModel.findAll({ attributes: ["uuid", "code", "name", "line_code", "is_active"] });
    const depCount = await DeparturesModel.count();

    console.log("\n=== HARBORS (" + harbors.length + ") ===");
    harbors.forEach((h) => console.log(`  ${h.code.padEnd(8)} ${h.name.padEnd(30)} ${h.city || ""}`));
    console.log("\n=== LINES (" + lines.length + ") ===");
    lines.forEach((l) => console.log(`  ${(l.code || "").padEnd(8)} ${l.name}`));
    console.log("\n=== TIMETABLES (" + timetables.length + ") ===");
    timetables.forEach((t) => console.log(`  ${t.code.padEnd(12)} line:${t.line_code} ${t.name} active:${t.is_active}`));
    console.log("\nDepartures total rows: " + depCount);

    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
