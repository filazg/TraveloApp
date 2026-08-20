// Povezuje luke s lučkim upravama — popunjava harbors.region_uuid.
//
// Luke su u bazu ušle sa samo upisanim nazivom uprave (harbors.region), dok je
// harbors.region_uuid ostao prazan. Sve što grupira po upravi (npr. izvještaj
// lučkih naknada) tada svu prodaju strpa u jednu hrpu, jer je ključ svugdje
// isti prazan uuid. Skripta uparuje po nazivu s tablicom regions.
//
// Usage:
//   node backfill_harbor_regions.js --dry-run   -> samo ispiši što bi se promijenilo
//   node backfill_harbor_regions.js             -> upiši
//
const { syncDatabaseConfigData, getDatabaseConfigData } = require("./controllers/configSyncController");
const { initSequelize } = require("./config/database");
const { initModels } = require("./dbModels");

// Nazivi se u praksi razlikuju po sitnicama (dvostruki razmaci, mala/velika
// slova, navodnici), pa se uspoređuje normalizirani oblik.
const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toUpperCase();

(async () => {
    const dry = process.argv.includes("--dry-run");
    console.log("Backfill harbors.region_uuid", dry ? "(dry run)" : "");

    await syncDatabaseConfigData();
    const dbCfg = await getDatabaseConfigData();
    await initSequelize(dbCfg);
    const { HarborsModel, RegionsModel } = initModels();

    const regions = await RegionsModel.findAll();
    const byName = new Map(regions.map((r) => [norm(r.name), r]));
    console.log(`lučkih uprava u bazi: ${regions.length}`);

    const harbors = await HarborsModel.findAll();
    console.log(`luka u bazi: ${harbors.length}`);

    let updated = 0;
    const unmatched = [];

    for (const h of harbors) {
        if (h.region_uuid) continue;
        const region = byName.get(norm(h.region));
        if (!region) {
            unmatched.push(h);
            continue;
        }
        console.log(`  ${h.code} ${h.name} -> ${region.name} (${region.uuid})`);
        if (!dry) {
            // Naziv se prepisuje iz regions da luka i uprava ne odu u razmimoilaženje.
            await HarborsModel.update(
                { region_uuid: region.uuid, region: region.name },
                { where: { id: h.id } }
            );
        }
        updated++;
    }

    console.log(`\n${dry ? "bilo bi povezano" : "povezano"}: ${updated}`);
    if (unmatched.length) {
        console.log(`bez pronađene uprave: ${unmatched.length} — treba ih ručno odabrati u portalu (Boat → Luke):`);
        for (const h of unmatched) console.log(`  ${h.code} ${h.name} — upisano: "${h.region || "(prazno)"}"`);
    }
    process.exit(0);
})().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
