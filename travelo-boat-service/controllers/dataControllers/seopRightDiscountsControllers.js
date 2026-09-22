// Popusti po pravu na povlašteni prijevoz.
//
// Redak postoji samo za pravo kojem je ured upisao postotak. Spremanje šalje
// cijelu tablicu iz portala odjednom (ekran je mreža od dvadesetak redaka, ne
// pojedinačni unos), pa se ovdje radi upsert po šifri i briše ono što je iz
// portala nestalo.
//
// Katalog prava se ovdje namjerno ne provjerava: drži ga akd servis, a Pravilnik
// ga mijenja neovisno o nama. Šifra koju katalog još ne poznaje mora se moći
// upisati, inače bi novo pravo čekalo izmjenu koda.

const cijelBroj = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : 0;
};

// Postotak izvan 0–100 nije popust nego greška u unosu. Odbija se cijelo
// spremanje, da se ne dogodi da pola tablice prođe a pola ne.
const provjeriPostotak = (n) => n >= 0 && n <= 100;

const getSeopRightDiscountsController = async (req, res) => {
    const { SeopRightDiscountModel } = req.app.locals.models;
    try {
        const redci = await SeopRightDiscountModel.findAll({ order: [["code", "ASC"]] });
        res.send({ status: 200, data: { discounts: redci.map((r) => r.toJSON()) } });
    } catch (error) {
        console.log("getSeopRightDiscountsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

const updateSeopRightDiscountsController = async (req, res) => {
    const { SeopRightDiscountModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const ulaz = Array.isArray(data.discounts) ? data.discounts : [];

        const zaUpis = [];
        for (const r of ulaz) {
            const code = String(r?.code || "").trim();
            if (!code) continue;
            const pct = cijelBroj(r?.discount_pct);
            if (!provjeriPostotak(pct)) {
                return res.status(400).send({
                    status: 400,
                    data: { message: `Postotak za pravo ${code} mora biti između 0 i 100.` },
                });
            }
            zaUpis.push({
                code,
                discount_pct: pct,
                is_active: r?.is_active !== false,
                updated_by: data.updated_by || null,
            });
        }

        // Upsert po šifri, pa brisanje onoga što portal više ne šalje — tako
        // uklanjanje retka u portalu stvarno ukloni popust, a ne ostavi ga da
        // tiho vrijedi na uređajima.
        for (const red of zaUpis) {
            const [zapis, novi] = await SeopRightDiscountModel.findOrCreate({
                where: { code: red.code },
                defaults: red,
            });
            if (!novi) await zapis.update(red);
        }

        const zadrzane = zaUpis.map((r) => r.code);
        const sve = await SeopRightDiscountModel.findAll();
        for (const zapis of sve) {
            if (!zadrzane.includes(zapis.code)) await zapis.destroy();
        }

        const redci = await SeopRightDiscountModel.findAll({ order: [["code", "ASC"]] });
        res.send({ status: 200, data: { discounts: redci.map((r) => r.toJSON()) } });
    } catch (error) {
        console.log("updateSeopRightDiscountsController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    getSeopRightDiscountsController,
    updateSeopRightDiscountsController,
};
