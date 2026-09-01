// Dnevni izvještaj realizacije — agregira `invoices` + `invoice_items` po danu,
// cost-centru i liniji. Logika prihoda:
//   - Stavke karte čiji je polazak u istom mjesecu kao i račun → 7514 (Prihod
//     od karata).
//   - Stavke karte čiji je polazak u sljedećem mjesecu → 2250 (Predujam) s
//     analitikom AdvancePeriod = "YYYY-MM" (obračunsko razdoblje polaska).
//   - Stavke karte koje se "koriste" na dan D (departure::date == D) a račun je
//     iz prijašnjeg mjeseca → reklasifikacija (debit 2250 / credit 7514) s
//     istom AdvancePeriod analitikom.
//   - Lučka pristojba prati istu podjelu kao i prihod: dio koji pripada kartama
//     za tekući mjesec ide na HARBOR_TAX, a dio za buduće razdoblje na
//     PREDUJAM_HARBOR_TAX, uz istu AdvancePeriod analitiku i istu
//     reklasifikaciju na dan polaska. Pristojba se naplaćuje zajedno s kartom,
//     pa bi priznavanje cijelog iznosa odmah preteglo mjesec u kojem je karta
//     samo prodana.
// VAT se priznaje na datum računa (ne deferira se).
// Plaćanje se rasporedi po (cc, payment_method, clerk) — osim R1 i F2 računa
// plaćenih virmanom, koji idu svaki u svoj redak i nose OIB kupca.
const axios = require("axios");
const { Op } = require("sequelize");
const { getCoreServiceConfigData } = require("../configSyncController");

const httpGet = async (url) => {
    const r = await axios.get(url, { timeout: 15000, validateStatus: () => true });
    return r.data?.data || r.data || {};
};

// Pull supporting reference data: backoffice + boat-service (linije + nositelji).
const fetchReferences = async () => {
    const core = getCoreServiceConfigData() || {};
    const boUrl = core?.services?.backoffice?.url;
    const btUrl = core?.services?.boat?.url;
    if (!boUrl) throw new Error("backoffice URL not configured");

    const [bd, pm, us, ac, am, co, ln] = await Promise.all([
        httpGet(`${boUrl}/billing_devices`),
        httpGet(`${boUrl}/payment_methods`),
        httpGet(`${boUrl}/users`),
        httpGet(`${boUrl}/accounts`),
        httpGet(`${boUrl}/account_mappings`),
        httpGet(`${boUrl}/company`),
        btUrl ? httpGet(`${btUrl}/lines`) : Promise.resolve({}),
    ]);

    const billingDevices = new Map();
    for (const r of bd?.billing_devices || bd?.data?.billing_devices || []) {
        billingDevices.set(r.uuid, r);
    }
    const paymentMethods = new Map();
    for (const r of pm?.payment_methods || pm?.data?.payment_methods || []) {
        paymentMethods.set(r.uuid, r);
    }
    const users = new Map();
    // Stariji računi s POS-a nemaju operater_uuid (terminal ga je počeo slati
    // naknadno), pa korisnika indeksiramo i po oznaci i po korisničkom imenu —
    // inače isti operater ispadne u dva reda razrade, jedan bez SAOP referenta.
    const usersByMark = new Map();
    for (const r of us?.users || us?.data?.users || []) {
        users.set(r.uuid, r);
        if (r.mark) usersByMark.set(String(r.mark).toLowerCase(), r);
        if (r.username) usersByMark.set(String(r.username).toLowerCase(), r);
    }
    const accounts = new Map();
    for (const r of ac?.accounts || []) accounts.set(r.uuid, r);
    const mappings = new Map();
    for (const r of am?.account_mappings || []) mappings.set(r.mapping_key, r);
    const company =
        (Array.isArray(co?.company) ? co.company[0] : co?.company) ||
        co?.data?.company ||
        null;
    const lines = new Map();
    for (const r of ln?.lines || ln?.data?.lines || []) {
        lines.set(r.code, r);
    }

    return { billingDevices, paymentMethods, users, usersByMark, accounts, mappings, company, lines };
};

const resolveAccount = (mappingKey, mappings, accounts) => {
    const m = mappings.get(mappingKey);
    if (!m) return null;
    const acc = accounts.get(m.account_uuid);
    if (!acc) return null;
    return { code: acc.code, name: acc.name, direction: m.direction || "credit" };
};

const toDateKey = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const toMonthKey = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
};

const parseDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === "string") {
        // Polazak se zapisuje u dva oblika: POS i boat servis kao
        // "DD.MM.YYYY. HH:mm", a web prodaja kao "DD/MM/YYYY HH:mm" (dan i mjesec
        // znaju biti bez vodeće nule). new Date() ne zna pročitati ni jedan od
        // njih i vrati Invalid Date — a tada polazak ispadne u tekući mjesec i
        // predujam za buduće razdoblje se nikad ne iskaže.
        const hr = /^(\d{1,2})[./](\d{1,2})[./](\d{4})\.?(?:\s+(\d{1,2}):(\d{2}))?/.exec(v.trim());
        if (hr) {
            const [, d, mo, y, hh = "0", mm = "0"] = hr;
            return new Date(+y, +mo - 1, +d, +hh, +mm);
        }
    }
    // ISO "YYYY-MM-DDTHH:MM:SS" ili "YYYY-MM-DD HH:MM:SS"
    const d = new Date(typeof v === "string" ? v.replace(" ", "T") : v);
    return isNaN(d.getTime()) ? null : d;
};

// Empty bucket helper for one (day, cost-centre) cell.
const emptyBucket = (cost_center, billing_device_name) => ({
    cost_center,
    billing_device_name,
    invoice_count: 0,
    invoice_uuids: new Set(),
    totals: { harbor_tax: 0, vat_base: 0, vat: 0, amount: 0 },
    // Per-line revenue split: { [line_code]: { line_name, saop_cost_bearer, vat_base_current, vat, harbor_tax, vat_base_future: {YYYY-MM: amount}, item_count } }
    lines: new Map(),
    // Per (pm_uuid, clerk_id) → amount for the debit side
    byPaymentClerk: new Map(),
    // R1 i F2 računi plaćeni virmanom. Ne ulaze u zbroj gore: knjigovodstvo ih
    // mora vidjeti pojedinačno da ih može upariti s izvodom i s kupcem, pa
    // svaki dobiva vlastiti redak i nosi OIB.
    virmanInvoices: [],
    // Reklasifikacije: items čiji je departure dan D ali račun je iz starijeg mjeseca
    // { [line_code|src_period]: { line_code, line_name, saop_cost_bearer, src_period, vat_base, harbor_tax } }
    reclassifications: new Map(),
});

const ensureLine = (bucket, item, refs) => {
    const code = item.line_code || "—";
    if (!bucket.lines.has(code)) {
        const line = refs.lines.get(code);
        bucket.lines.set(code, {
            line_code: code,
            line_name: item.line_name || line?.name || "",
            saop_cost_bearer: line?.saop_cost_bearer || null,
            vat_base_current: 0,
            vat: 0,
            // harbor_tax je zbroj tekućeg i budućeg — služi prikazu ukupnog
            // iznosa po liniji; knjiženje ide iz razdvojenih polja ispod.
            harbor_tax: 0,
            harbor_tax_current: 0,
            vat_base_future: new Map(), // YYYY-MM → vat_base
            harbor_tax_future: new Map(), // YYYY-MM → lučka pristojba
            item_count: 0,
        });
    }
    return bucket.lines.get(code);
};

const buildJournalEntries = (day, bucket, refs) => {
    const ref = `${day}/${bucket.cost_center || "n/a"}`;
    const entries = [];
    const warnings = [];

    const accFor = (key) => {
        const a = resolveAccount(key, refs.mappings, refs.accounts);
        if (!a) warnings.push(`Nedostaje mapiranje konta za ${key}`);
        return a;
    };
    const accVAT = accFor("VAT");
    const accHARBOR = accFor("HARBOR_TAX");
    const accNET = accFor("NET_REVENUE");
    const accPRED = accFor("PREDUJAM");
    // Predujam za lučke naknade traži se tek kad postoji karta za buduće
    // razdoblje. Da dan bez takvih karata ne javlja upozorenje za mapiranje koje
    // mu ne treba, konto se dohvaća lijeno i pamti.
    let accPredHarborCached;
    const accPredHarbor = () => {
        if (accPredHarborCached === undefined) accPredHarborCached = accFor("PREDUJAM_HARBOR_TAX");
        return accPredHarborCached;
    };

    // Dijeljenje lučke pristojbe ima smisla samo ako ima karata za buduće
    // razdoblje; tek tada se traži konto predujma i tek tada se javlja ako ga
    // nema. Dan bez takvih karata ne dobiva upozorenje za mapiranje koje mu ne
    // treba, a i ne mijenja ponašanje.
    const imaBuducuLucku =
        [...bucket.lines.values()].some((l) =>
            [...l.harbor_tax_future.values()].some((a) => Math.abs(a) > 0.005),
        ) ||
        [...bucket.reclassifications.values()].some((r) => Math.abs(r.harbor_tax || 0) > 0.005);
    const dijeliLucku = imaBuducuLucku && !!accPredHarbor();

    // Per-line revenue side
    for (const [, lineBucket] of bucket.lines) {
        const analyticsBase = {
            CostCentre: bucket.cost_center || "",
            CostBearer: lineBucket.saop_cost_bearer || "",
        };
        // PDV per line
        if (accVAT && Math.abs(lineBucket.vat) > 0.005) {
            entries.push({
                JournalEntryDate: day,
                JournalEntryDescription: `PDV ${day} — ${lineBucket.line_name}`,
                Account: accVAT.code,
                DebitAmountInDomesticCurrency: 0,
                CreditAmountInDomesticCurrency: Number(lineBucket.vat.toFixed(2)),
                JournalType: "IRA",
                ReferenceDocument: ref,
                Analytics: { ...analyticsBase },
            });
        }
        // Lučka pristojba. Dok konto predujma nije mapiran, cijeli iznos ide na
        // HARBOR_TAX kao i prije — inače bi dio pristojbe ispao iz knjiženja i
        // dan ne bi štimao. Upozorenje iz accFor kaže da mapiranje nedostaje.
        const harborCurrent = dijeliLucku
            ? lineBucket.harbor_tax_current
            : lineBucket.harbor_tax;
        if (accHARBOR && Math.abs(harborCurrent) > 0.005) {
            entries.push({
                JournalEntryDate: day,
                JournalEntryDescription: `Lučka pristojba ${day} — ${lineBucket.line_name}`,
                Account: accHARBOR.code,
                DebitAmountInDomesticCurrency: 0,
                CreditAmountInDomesticCurrency: Number(harborCurrent.toFixed(2)),
                JournalType: "IRA",
                ReferenceDocument: ref,
                Analytics: { ...analyticsBase },
            });
        }
        // Lučka pristojba za karte budućeg razdoblja — predujam, po razdoblju
        if (dijeliLucku) {
            for (const [period, amt] of lineBucket.harbor_tax_future) {
                if (Math.abs(amt) < 0.005) continue;
                entries.push({
                    JournalEntryDate: day,
                    JournalEntryDescription: `Predujam za lučke naknade ${day} — ${lineBucket.line_name} (razd. ${period})`,
                    Account: accPredHarbor().code,
                    DebitAmountInDomesticCurrency: 0,
                    CreditAmountInDomesticCurrency: Number(amt.toFixed(2)),
                    JournalType: "IRA",
                    ReferenceDocument: ref,
                    Analytics: { ...analyticsBase, AdvancePeriod: period },
                });
            }
        }
        // Netto prihod (current period) per line
        if (accNET && Math.abs(lineBucket.vat_base_current) > 0.005) {
            entries.push({
                JournalEntryDate: day,
                JournalEntryDescription: `Prihod od karata ${day} — ${lineBucket.line_name}`,
                Account: accNET.code,
                DebitAmountInDomesticCurrency: 0,
                CreditAmountInDomesticCurrency: Number(lineBucket.vat_base_current.toFixed(2)),
                JournalType: "IRA",
                ReferenceDocument: ref,
                Analytics: { ...analyticsBase },
            });
        }
        // Predujam (per future period) per line
        if (accPRED) {
            for (const [period, amt] of lineBucket.vat_base_future) {
                if (Math.abs(amt) < 0.005) continue;
                entries.push({
                    JournalEntryDate: day,
                    JournalEntryDescription: `Predujam ${day} — ${lineBucket.line_name} (razd. ${period})`,
                    Account: accPRED.code,
                    DebitAmountInDomesticCurrency: 0,
                    CreditAmountInDomesticCurrency: Number(amt.toFixed(2)),
                    JournalType: "IRA",
                    ReferenceDocument: ref,
                    Analytics: { ...analyticsBase, AdvancePeriod: period },
                });
            }
        }
    }

    // Debit side: po (pm, clerk)
    for (const [pmUuid, byClerk] of bucket.byPaymentClerk.entries()) {
        const pm = refs.paymentMethods.get(pmUuid);
        const pmKey = `PAYMENT:${pmUuid}`;
        const pmName = pm?.name || pmUuid;
        for (const [clerkId, amount] of byClerk.entries()) {
            const acc = accFor(pmKey);
            if (!acc) continue;
            entries.push({
                JournalEntryDate: day,
                JournalEntryDescription: `Naplata ${day} — ${pmName}`,
                Account: acc.code,
                DebitAmountInDomesticCurrency: Number(amount.toFixed(2)),
                CreditAmountInDomesticCurrency: 0,
                JournalType: "IRA",
                ReferenceDocument: ref,
                Analytics: { CostCentre: bucket.cost_center || "", Referent: clerkId || "" },
            });
        }
    }

    // R1 i F2 računi plaćeni virmanom — svaki u vlastitom retku. Uz redak ide
    // OIB kupca (VATIdentificationNumber je naziv koji SAOP koristi za porezni
    // broj stranke), da se knjiženje može upariti s kupcem bez traženja po
    // broju računa.
    for (const v of bucket.virmanInvoices) {
        if (Math.abs(v.amount) < 0.005) continue;
        const acc = accFor(`PAYMENT:${v.payment_method_uuid}`);
        if (!acc) continue;
        const oznaka = v.invoice_code || v.invoice_uuid;
        entries.push({
            JournalEntryDate: day,
            JournalEntryDescription:
                `Naplata virmanom ${day} — ${v.doc_type} ${oznaka}` +
                (v.buyer_name ? ` · ${v.buyer_name}` : ""),
            Account: acc.code,
            DebitAmountInDomesticCurrency: Number(v.amount.toFixed(2)),
            CreditAmountInDomesticCurrency: 0,
            JournalType: "IRA",
            ReferenceDocument: ref,
            Document: oznaka,
            CustomerName: v.buyer_name || "",
            VATIdentificationNumber: v.buyer_oib || "",
            Analytics: {
                CostCentre: bucket.cost_center || "",
                Referent: v.saop_clerk_id || "",
            },
        });
        if (!v.buyer_oib) {
            warnings.push(`${v.doc_type} račun ${oznaka} plaćen virmanom nema OIB kupca`);
        }
    }

    // Reklasifikacije: debit 2250 / credit 7514 po liniji + src_period
    if (bucket.reclassifications.size > 0) {
        for (const [, r] of bucket.reclassifications) {
            if (Math.abs(r.vat_base) < 0.005) continue;
            const analyticsBase = {
                CostCentre: bucket.cost_center || "",
                CostBearer: r.saop_cost_bearer || "",
                AdvancePeriod: r.src_period,
            };
            if (accPRED) {
                entries.push({
                    JournalEntryDate: day,
                    JournalEntryDescription: `Reklasifikacija predujam→prihod ${day} — ${r.line_name} (razd. ${r.src_period})`,
                    Account: accPRED.code,
                    DebitAmountInDomesticCurrency: Number(r.vat_base.toFixed(2)),
                    CreditAmountInDomesticCurrency: 0,
                    JournalType: "IRA",
                    ReferenceDocument: ref,
                    Analytics: { ...analyticsBase },
                });
            }
            if (accNET) {
                entries.push({
                    JournalEntryDate: day,
                    JournalEntryDescription: `Reklasifikacija predujam→prihod ${day} — ${r.line_name} (razd. ${r.src_period})`,
                    Account: accNET.code,
                    DebitAmountInDomesticCurrency: 0,
                    CreditAmountInDomesticCurrency: Number(r.vat_base.toFixed(2)),
                    JournalType: "IRA",
                    ReferenceDocument: ref,
                    Analytics: { ...analyticsBase },
                });
            }
        }

        // Ista reklasifikacija za lučku pristojbu — bez nje bi predujam za
        // lučke naknade rastao i nikad se ne bi zatvorio. Preskače se dok konto
        // predujma nije mapiran, jer tada pristojba nikad nije ni odgođena.
        for (const [, r] of dijeliLucku ? bucket.reclassifications : []) {
            if (Math.abs(r.harbor_tax || 0) < 0.005) continue;
            const analyticsBase = {
                CostCentre: bucket.cost_center || "",
                CostBearer: r.saop_cost_bearer || "",
                AdvancePeriod: r.src_period,
            };
            {
                entries.push({
                    JournalEntryDate: day,
                    JournalEntryDescription: `Reklasifikacija predujam→lučka naknada ${day} — ${r.line_name} (razd. ${r.src_period})`,
                    Account: accPredHarbor().code,
                    DebitAmountInDomesticCurrency: Number(r.harbor_tax.toFixed(2)),
                    CreditAmountInDomesticCurrency: 0,
                    JournalType: "IRA",
                    ReferenceDocument: ref,
                    Analytics: { ...analyticsBase },
                });
            }
            if (accHARBOR) {
                entries.push({
                    JournalEntryDate: day,
                    JournalEntryDescription: `Reklasifikacija predujam→lučka naknada ${day} — ${r.line_name} (razd. ${r.src_period})`,
                    Account: accHARBOR.code,
                    DebitAmountInDomesticCurrency: 0,
                    CreditAmountInDomesticCurrency: Number(r.harbor_tax.toFixed(2)),
                    JournalType: "IRA",
                    ReferenceDocument: ref,
                    Analytics: { ...analyticsBase },
                });
            }
        }
    }

    return { entries, warnings };
};

const dailyRealizationReportController = async (req, res) => {
    const { InvoiceModel, InvoiceItemsModel } = req.app.locals.models;
    const sequelize = InvoiceModel.sequelize;
    try {
        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;
        if (!from || !to || isNaN(from) || isNaN(to)) {
            return res
                .status(400)
                .send({ status: 400, error: "from/to required (YYYY-MM-DD)" });
        }
        to.setUTCHours(23, 59, 59, 999);

        const refs = await fetchReferences();

        // (1) Računi izdani u rasponu
        const invoicesIssued = await InvoiceModel.findAll({
            where: {
                invoice_date: { [Op.gte]: from, [Op.lte]: to },
                invoice_canceled: false,
                invoice_is_pay: true,
            },
            order: [["invoice_date", "ASC"]],
        });
        const invByUuid = new Map();
        for (const inv of invoicesIssued) invByUuid.set(inv.invoice_uuid, inv);

        const issuedUuids = [...invByUuid.keys()].filter(Boolean);
        const itemsForIssued = issuedUuids.length
            ? await InvoiceItemsModel.findAll({
                  where: { invoice_uuid: { [Op.in]: issuedUuids } },
              })
            : [];

        // (2) Items čiji je departure u rasponu (za reklasifikacije) —
        //     za svaki item nam treba i invoice meta (date, billing_device, operator).
        const fromDateStr = toDateKey(from);
        const toDateStr = toDateKey(to);
        const reclassRows = await sequelize.query(
            `SELECT it.*, i.invoice_date AS i_invoice_date,
                    i.invoice_billing_device_uuid AS i_bd_uuid,
                    i.operater_uuid AS i_operater_uuid
             FROM invoice_items it
             JOIN invoices i ON i.invoice_uuid = it.invoice_uuid
             WHERE LEFT(it.departure, 10) BETWEEN :from AND :to
               AND i.invoice_canceled = false
               AND i.invoice_is_pay = true`,
            {
                replacements: { from: fromDateStr, to: toDateStr },
                type: sequelize.QueryTypes.SELECT,
            },
        );

        // byDay → byCC → bucket
        const byDay = new Map();
        const ensureBucket = (day, ccKey, cost_center, billing_device_name) => {
            if (!byDay.has(day)) byDay.set(day, new Map());
            const byCC = byDay.get(day);
            if (!byCC.has(ccKey)) byCC.set(ccKey, emptyBucket(cost_center, billing_device_name));
            return byCC.get(ccKey);
        };

        // === Pass 1: stavke za račune izdane u rasponu ===
        for (const item of itemsForIssued) {
            const inv = invByUuid.get(item.invoice_uuid);
            if (!inv) continue;
            const day = toDateKey(inv.invoice_date);
            const bd = refs.billingDevices.get(inv.invoice_billing_device_uuid);
            const cost_center = bd?.cost_center || "";
            const bdName = bd?.name || "";
            const ccKey = cost_center || "_unknown";
            const bucket = ensureBucket(day, ccKey, cost_center, bdName);

            // Ako je ovo prvi item za ovaj invoice → broji ga + accumuliraj invoice-level totals
            if (!bucket.invoice_uuids.has(inv.invoice_uuid)) {
                bucket.invoice_uuids.add(inv.invoice_uuid);
                bucket.invoice_count += 1;
                bucket.totals.amount += Number(inv.invoice_amount || 0);
                bucket.totals.harbor_tax += Number(inv.invoice_harbor_tax || 0);
                bucket.totals.vat += Number(inv.invoice_vat || 0);
                bucket.totals.vat_base += Number(inv.invoice_vat_base || 0);

                // Prvo po uuid-u; ako ga račun nema, po oznaci pa po imenu operatera.
                const user =
                    refs.users.get(inv.operater_uuid) ||
                    refs.usersByMark.get(String(inv.operator_mark || "").toLowerCase()) ||
                    refs.usersByMark.get(String(inv.operater_name || "").toLowerCase());
                const clerkId = user?.saop_clerk_id || "";
                const pmUuid = inv.invoice_payment_method_uuid || "";

                // Virman se prepoznaje po vrsti sredstva plaćanja ("T" —
                // transakcijski račun), ne po nazivu: naziv je slobodan tekst i
                // po klijentima se razlikuje.
                const pm = refs.paymentMethods.get(pmUuid);
                const isVirman = String(pm?.payment_type_acr || "").toUpperCase() === "T";
                // F2 ima prednost nad R1: račun koji traži fiskalizaciju je F2 i
                // kad uz njega stoji OIB kupca.
                const docType = inv.fiskal_required ? "F2" : (inv.buyer_oib ? "R1" : null);

                if (isVirman && docType) {
                    bucket.virmanInvoices.push({
                        invoice_uuid: inv.invoice_uuid,
                        invoice_code: inv.invoice_code || "",
                        doc_type: docType,
                        payment_method_uuid: pmUuid,
                        payment_method_name: pm?.name || "",
                        saop_clerk_id: clerkId,
                        buyer_name: inv.buyer_company_name || inv.buyer_name || "",
                        buyer_oib: inv.buyer_oib || "",
                        amount: Number(inv.invoice_amount || 0),
                    });
                } else {
                    if (!bucket.byPaymentClerk.has(pmUuid))
                        bucket.byPaymentClerk.set(pmUuid, new Map());
                    const m = bucket.byPaymentClerk.get(pmUuid);
                    m.set(clerkId, (m.get(clerkId) || 0) + Number(inv.invoice_amount || 0));
                }
            }

            // Per-line accumulate
            const lineBucket = ensureLine(bucket, item, refs);
            lineBucket.item_count += 1;
            lineBucket.vat += Number(item.item_vat || 0);

            // Predujam logika: gdje ide osnovica, a gdje lučka pristojba?
            // Obje prate polazak karte, ne datum računa.
            const dep = parseDate(item.departure);
            const invMonth = toMonthKey(inv.invoice_date);
            const depMonth = dep ? toMonthKey(dep) : invMonth;
            const itemNet = Number(item.item_vat_base || 0);
            const itemHarbor = Number(item.item_harbor_fee || 0);
            lineBucket.harbor_tax += itemHarbor;
            if (depMonth === invMonth) {
                lineBucket.vat_base_current += itemNet;
                lineBucket.harbor_tax_current += itemHarbor;
            } else {
                lineBucket.vat_base_future.set(
                    depMonth,
                    (lineBucket.vat_base_future.get(depMonth) || 0) + itemNet,
                );
                lineBucket.harbor_tax_future.set(
                    depMonth,
                    (lineBucket.harbor_tax_future.get(depMonth) || 0) + itemHarbor,
                );
            }
        }

        // === Pass 2: reklasifikacije ===
        // Za svaki item gdje departure_date::date == day i invoice month != day month → debit predujam, credit prihod
        for (const row of reclassRows) {
            const dep = parseDate(row.departure);
            if (!dep) continue;
            const day = toDateKey(dep);
            const invMonth = toMonthKey(row.i_invoice_date);
            const dayMonth = day.slice(0, 7);
            if (invMonth >= dayMonth) continue; // nije reklasifikacija (isti ili kasniji mjesec računa)

            const bd = refs.billingDevices.get(row.i_bd_uuid);
            const cost_center = bd?.cost_center || "";
            const bdName = bd?.name || "";
            const ccKey = cost_center || "_unknown";
            const bucket = ensureBucket(day, ccKey, cost_center, bdName);

            const code = row.line_code || "—";
            const line = refs.lines.get(code);
            const reclassKey = `${code}|${invMonth}`;
            if (!bucket.reclassifications.has(reclassKey)) {
                bucket.reclassifications.set(reclassKey, {
                    line_code: code,
                    line_name: row.line_name || line?.name || "",
                    saop_cost_bearer: line?.saop_cost_bearer || null,
                    src_period: invMonth,
                    vat_base: 0,
                    harbor_tax: 0,
                });
            }
            const rec = bucket.reclassifications.get(reclassKey);
            rec.vat_base += Number(row.item_vat_base || 0);
            rec.harbor_tax += Number(row.item_harbor_fee || 0);
        }

        // === Output ===
        const days = [];
        for (const [day, byCC] of [...byDay.entries()].sort()) {
            const costCenters = [];
            for (const [, bucket] of byCC.entries()) {
                const { entries, warnings } = buildJournalEntries(day, bucket, refs);
                const lineBreakdown = [...bucket.lines.values()].map((l) => ({
                    line_code: l.line_code,
                    line_name: l.line_name,
                    saop_cost_bearer: l.saop_cost_bearer,
                    item_count: l.item_count,
                    vat_base_current: Number(l.vat_base_current.toFixed(2)),
                    vat_base_future: [...l.vat_base_future.entries()].map(([p, a]) => ({
                        period: p,
                        amount: Number(a.toFixed(2)),
                    })),
                    vat: Number(l.vat.toFixed(2)),
                    harbor_tax: Number(l.harbor_tax.toFixed(2)),
                    harbor_tax_current: Number(l.harbor_tax_current.toFixed(2)),
                    harbor_tax_future: [...l.harbor_tax_future.entries()].map(([p, a]) => ({
                        period: p,
                        amount: Number(a.toFixed(2)),
                    })),
                }));
                const reclassifications = [...bucket.reclassifications.values()].map((r) => ({
                    line_code: r.line_code,
                    line_name: r.line_name,
                    saop_cost_bearer: r.saop_cost_bearer,
                    src_period: r.src_period,
                    vat_base: Number(r.vat_base.toFixed(2)),
                    harbor_tax: Number((r.harbor_tax || 0).toFixed(2)),
                }));
                costCenters.push({
                    cost_center: bucket.cost_center,
                    billing_device_name: bucket.billing_device_name,
                    invoice_count: bucket.invoice_count,
                    totals: {
                        harbor_tax: Number(bucket.totals.harbor_tax.toFixed(2)),
                        vat_base: Number(bucket.totals.vat_base.toFixed(2)),
                        vat: Number(bucket.totals.vat.toFixed(2)),
                        amount: Number(bucket.totals.amount.toFixed(2)),
                    },
                    byPaymentClerk: [...bucket.byPaymentClerk.entries()].map(
                        ([pmUuid, clerks]) => {
                            const acc = resolveAccount(`PAYMENT:${pmUuid}`, refs.mappings, refs.accounts);
                            return {
                                payment_method_uuid: pmUuid,
                                payment_method_name: refs.paymentMethods.get(pmUuid)?.name || "",
                                account_code: acc?.code || null,
                                account_name: acc?.name || null,
                                clerks: [...clerks.entries()].map(([clerk, amt]) => ({
                                    saop_clerk_id: clerk,
                                    amount: Number(amt.toFixed(2)),
                                })),
                            };
                        },
                    ),
                    lineBreakdown,
                    reclassifications,
                    virmanInvoices: bucket.virmanInvoices.map((v) => ({
                        ...v,
                        amount: Number(v.amount.toFixed(2)),
                        account_code:
                            resolveAccount(`PAYMENT:${v.payment_method_uuid}`, refs.mappings, refs.accounts)?.code || null,
                    })),
                    journalEntries: entries,
                    warnings,
                });
            }
            days.push({ date: day, costCenters });
        }

        res.send({
            status: 200,
            data: {
                from: toDateKey(from),
                to: toDateKey(to),
                company_saop: {
                    organization_id: refs.company?.saop_organization_id || null,
                    link_to_book: refs.company?.saop_link_to_book || null,
                    default_customer: refs.company?.saop_default_customer || null,
                },
                days,
            },
        });
    } catch (error) {
        console.error("dailyRealizationReportController error:", error);
        res.status(500).send({ status: 500, error: error.message });
    }
};

// Stub: poslužuje ga "Pošalji" gumb po danu na DailyRealizationPage. Prima
// `{ date: "YYYY-MM-DD" }`. Za sada samo vraća echo — pravo slanje
// (POST /journals/AddJournal po batchu) dolazi kad potvrdimo da preview
// struktura izgleda kako treba.
const sendDailyRealizationToErpController = async (req, res) => {
    const date = req.body?.date || null;
    console.log(`[daily-realization] send_to_erp request for date=${date}`);
    res.send({
        status: 501,
        message: date
            ? `SAOP slanje za ${date} još nije implementirano (stub).`
            : "SAOP slanje još nije implementirano (stub). Očekujem { date: YYYY-MM-DD }.",
        date,
    });
};

module.exports = {
    dailyRealizationReportController,
    sendDailyRealizationToErpController,
};
