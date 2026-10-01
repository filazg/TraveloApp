const crypto = require("crypto");

const DEFAULT_CATEGORIES = [
    { code: "PASSANGER", name_hr: "Putnici", name_en: "Passengers" },
    { code: "VIP", name_hr: "VIP putnici", name_en: "VIP passengers" },
    { code: "PETS", name_hr: "Ljubimci", name_en: "Pets" },
    { code: "BICYCLE", name_hr: "Bicikli", name_en: "Bicycles" },
    // Vrsta karte iz ove kategorije ne troši kapacitet (npr. dojenče u naručju
    // kao dodatna karta) — performReserve je preskače, pa se ne rezervira ni
    // ne oslobađa. Vidi BEZ_KAPACITETA u bookingsController.
    { code: "BEZ_KAPACITETA", name_hr: "Ne zauzima kapacitet", name_en: "No capacity" },
];

module.exports = async function seedDefaults(models) {
    const { CapacityCategoryModel } = models;
    let inserted = 0;
    for (const c of DEFAULT_CATEGORIES) {
        const existing = await CapacityCategoryModel.findOne({ where: { code: c.code } });
        if (!existing) {
            await CapacityCategoryModel.create({
                uuid: crypto.randomUUID(),
                code: c.code,
                name_hr: c.name_hr,
                name_en: c.name_en,
                is_active: true,
            });
            inserted++;
        }
    }
    if (inserted) console.log(`BOOKING SERVICE seeded ${inserted} default capacity categories`);
};
