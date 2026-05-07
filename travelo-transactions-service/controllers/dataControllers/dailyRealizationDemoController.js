// DEMO controller — vraća sintetiziran (hardcoded) izvještaj koji NE čita
// stvarne podatke iz baze. Služi kao gotov primjer kako bi raport trebao
// izgledati kad sustav bude imao puno podataka. Uvijek koristi isti
// kontni plan i isti shape kao stvarni controller.
const toDateKey = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const fmt = (n) => Math.round(Number(n) * 100) / 100;

// Mali deterministički PRNG (mulberry32) — isti seed = iste vrijednosti.
function rng(seed) {
    let s = seed >>> 0;
    return function () {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const COMPANY = {
    organization_id: "2",
    link_to_book: "TraveloApp",
    default_customer: "0000556",
};

const COST_CENTERS = [
    { code: "POLA", billing_device_name: "POLA-01" },
    { code: "ZADAR", billing_device_name: "ZADAR-01" },
    { code: "fdsa", billing_device_name: "Centrala-01" },
];

const LINE = { code: "9141", name: "PULA ZADAR PULA", saop_cost_bearer: "NT-9141" };

const PAYMENTS = [
    { uuid: "demo-pm-gotovina", name: "Gotovina", account_code: "1009", account_name: "Gotovina" },
    { uuid: "demo-pm-kartice", name: "Kartice", account_code: "1207", account_name: "Kartice" },
];

const CLERKS = ["NF01", "MM01"];

// Mjeseci budućih razdoblja koje koristimo u predujmu (relativno na "report month").
// Demo uvijek pokazuje sva 4: lipanj, srpanj, kolovoz, rujan tekuće godine raporta.
function buildFuturePeriods(year) {
    return [
        `${year}-06`,
        `${year}-07`,
        `${year}-08`,
        `${year}-09`,
    ];
}

// Predhodna razdoblja iz kojih dolaze reklasifikacije.
function buildPastPeriod(year) {
    return `${year}-04`;
}

function buildCostCenterBucket(date, cc, year) {
    const dayN = parseInt(date.slice(8, 10), 10);
    const seed = parseInt(date.replace(/-/g, ""), 10) + cc.code.charCodeAt(0) * 31;
    const r = rng(seed);

    const itemCount = 8 + Math.floor(r() * 8); // 8-15 karata
    const netCurrent = fmt(40 + r() * 80);     // 40-120
    const futurePeriods = buildFuturePeriods(year);
    const future = futurePeriods.map((p, i) => ({
        period: p,
        amount: fmt(20 + r() * 90 + (3 - i) * 5),
    }));
    const futureSum = fmt(future.reduce((s, f) => s + f.amount, 0));

    const lineNet = fmt(netCurrent + futureSum);
    const harbor = fmt(itemCount * 0.5);
    const vat = fmt(lineNet * 0.25);
    const ccAmount = fmt(lineNet + vat + harbor);

    const line = {
        line_code: LINE.code,
        line_name: LINE.name,
        saop_cost_bearer: LINE.saop_cost_bearer,
        item_count: itemCount,
        vat_base_current: netCurrent,
        vat_base_future: future,
        vat,
        harbor_tax: harbor,
    };

    // Plaćanje: 50% gotovina, 50% kartice; svaki PM podijeljen po 2 clerka (60/40).
    const halfA = fmt(ccAmount * 0.55);
    const halfB = fmt(ccAmount - halfA);
    const splitClerks = (sum) => {
        const a = fmt(sum * 0.6);
        const b = fmt(sum - a);
        return [
            { saop_clerk_id: CLERKS[0], amount: a },
            { saop_clerk_id: CLERKS[1], amount: b },
        ];
    };
    const byPaymentClerk = [
        { ...PAYMENTS[0], payment_method_uuid: PAYMENTS[0].uuid, payment_method_name: PAYMENTS[0].name, clerks: splitClerks(halfA) },
        { ...PAYMENTS[1], payment_method_uuid: PAYMENTS[1].uuid, payment_method_name: PAYMENTS[1].name, clerks: splitClerks(halfB) },
    ];

    // Reklasifikacije iz travanj-mj.: 0-1 stavka po danu (ako dayN paran)
    const reclassifications = [];
    if (dayN % 2 === 0) {
        reclassifications.push({
            line_code: LINE.code,
            line_name: LINE.name,
            saop_cost_bearer: LINE.saop_cost_bearer,
            src_period: buildPastPeriod(year),
            vat_base: fmt(30 + r() * 80),
        });
    }

    // Journal entries
    const ref = `${date}/${cc.code}`;
    const cb = LINE.saop_cost_bearer;
    const entries = [];
    if (vat > 0) entries.push({
        JournalEntryDate: date,
        JournalEntryDescription: `PDV ${date} — ${LINE.name}`,
        Account: "240012",
        DebitAmountInDomesticCurrency: 0,
        CreditAmountInDomesticCurrency: vat,
        JournalType: "IRA",
        ReferenceDocument: ref,
        Analytics: { CostCentre: cc.code, CostBearer: cb },
    });
    if (harbor > 0) entries.push({
        JournalEntryDate: date,
        JournalEntryDescription: `Lučka pristojba ${date} — ${LINE.name}`,
        Account: "75144",
        DebitAmountInDomesticCurrency: 0,
        CreditAmountInDomesticCurrency: harbor,
        JournalType: "IRA",
        ReferenceDocument: ref,
        Analytics: { CostCentre: cc.code, CostBearer: cb },
    });
    if (netCurrent > 0) entries.push({
        JournalEntryDate: date,
        JournalEntryDescription: `Prihod od karata ${date} — ${LINE.name}`,
        Account: "7514",
        DebitAmountInDomesticCurrency: 0,
        CreditAmountInDomesticCurrency: netCurrent,
        JournalType: "IRA",
        ReferenceDocument: ref,
        Analytics: { CostCentre: cc.code, CostBearer: cb },
    });
    for (const f of future) {
        if (f.amount <= 0) continue;
        entries.push({
            JournalEntryDate: date,
            JournalEntryDescription: `Predujam ${date} — ${LINE.name} (razd. ${f.period})`,
            Account: "2250",
            DebitAmountInDomesticCurrency: 0,
            CreditAmountInDomesticCurrency: f.amount,
            JournalType: "IRA",
            ReferenceDocument: ref,
            Analytics: { CostCentre: cc.code, CostBearer: cb, AdvancePeriod: f.period },
        });
    }
    for (const pm of byPaymentClerk) {
        for (const c of pm.clerks) {
            if (c.amount <= 0) continue;
            entries.push({
                JournalEntryDate: date,
                JournalEntryDescription: `Naplata ${date} — ${pm.payment_method_name}`,
                Account: pm.account_code,
                DebitAmountInDomesticCurrency: c.amount,
                CreditAmountInDomesticCurrency: 0,
                JournalType: "IRA",
                ReferenceDocument: ref,
                Analytics: { CostCentre: cc.code, Referent: c.saop_clerk_id },
            });
        }
    }
    for (const rc of reclassifications) {
        entries.push({
            JournalEntryDate: date,
            JournalEntryDescription: `Reklas. predujam→prihod ${date} — ${rc.line_name} (razd. ${rc.src_period})`,
            Account: "2250",
            DebitAmountInDomesticCurrency: rc.vat_base,
            CreditAmountInDomesticCurrency: 0,
            JournalType: "IRA",
            ReferenceDocument: ref,
            Analytics: { CostCentre: cc.code, CostBearer: rc.saop_cost_bearer, AdvancePeriod: rc.src_period },
        });
        entries.push({
            JournalEntryDate: date,
            JournalEntryDescription: `Reklas. predujam→prihod ${date} — ${rc.line_name} (razd. ${rc.src_period})`,
            Account: "7514",
            DebitAmountInDomesticCurrency: 0,
            CreditAmountInDomesticCurrency: rc.vat_base,
            JournalType: "IRA",
            ReferenceDocument: ref,
            Analytics: { CostCentre: cc.code, CostBearer: rc.saop_cost_bearer, AdvancePeriod: rc.src_period },
        });
    }

    return {
        cost_center: cc.code,
        billing_device_name: cc.billing_device_name,
        invoice_count: itemCount,
        totals: {
            harbor_tax: harbor,
            vat_base: lineNet,
            vat,
            amount: ccAmount,
        },
        byPaymentClerk,
        lineBreakdown: [line],
        reclassifications,
        journalEntries: entries,
        warnings: [],
    };
}

const dailyRealizationDemoController = (req, res) => {
    try {
        const fromStr = req.query.from || "2026-05-01";
        const toStr = req.query.to || "2026-05-05";
        const from = new Date(fromStr);
        const to = new Date(toStr);
        if (isNaN(from) || isNaN(to)) {
            return res.status(400).send({ status: 400, error: "from/to required (YYYY-MM-DD)" });
        }
        const year = from.getUTCFullYear();
        const days = [];
        const cursor = new Date(from);
        let safety = 60;
        while (cursor <= to && safety-- > 0) {
            const date = toDateKey(cursor);
            const costCenters = COST_CENTERS.map((cc) => buildCostCenterBucket(date, cc, year));
            days.push({ date, costCenters });
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        res.send({
            status: 200,
            data: {
                from: toDateKey(from),
                to: toDateKey(to),
                company_saop: COMPANY,
                days,
                demo: true,
            },
        });
    } catch (error) {
        console.error("dailyRealizationDemoController error:", error);
        res.status(500).send({ status: 500, error: error.message });
    }
};

const sendDailyRealizationDemoToErpController = (req, res) => {
    const date = req.body?.date || null;
    res.send({
        status: 501,
        message: date
            ? `DEMO: SAOP slanje za ${date} se ne izvršava (sintetski podaci).`
            : "DEMO: SAOP slanje se ne izvršava (sintetski podaci).",
        date,
    });
};

module.exports = {
    dailyRealizationDemoController,
    sendDailyRealizationDemoToErpController,
};
