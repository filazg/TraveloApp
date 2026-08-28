const axios = require("axios");
const { companyModel } = require("../db/models/BasicData.cjs");
const { invoicesModel, invoiceTransportItemsModel } = require("../db/models/InvoicesData.cjs");
const { shiftModel, shiftFinancModel, shiftSaleModel } = require("../db/models/ShiftsData.cjs");
const { ticketsModel } = require("../db/models/TicketsData.cjs");
const { pairingDataModel } = require("../db/models/Pairing.cjs");
const { systemSettingsDataModel } = require("../db/models/Settings.cjs");
const { shiftPrintHelper } = require("../helpers/printHelpers/shiftPrintHelper.cjs");
const { Op } = require("sequelize");
const crypto = require("crypto");

// Pošalji jednu smjenu na backend (best-effort). Backend (transactions-service
// /terminal_shift) je idempotentan po shift_uuid pa retry je siguran.
async function pushShiftToBackend(shiftUuid) {
    try {
        const settings = await systemSettingsDataModel.findOne();
        const pairing = await pairingDataModel.findOne();
        const backendUrl = settings?.backend_url;
        const token = pairing?.token;
        if (!backendUrl || !token) return { ok: false, reason: "no_backend_url_or_token" };
        const shift = await shiftModel.findOne({ where: { shift_uuid: shiftUuid } });
        if (!shift) return { ok: false, reason: "shift_not_found" };
        const shiftFinance = await shiftFinancModel.findAll({ where: { shift_uuid: shiftUuid } });
        const envelope = {
            shift: shift.toJSON(),
            shift_finance: shiftFinance.map((f) => f.toJSON()),
        };
        const resp = await axios.post(backendUrl + "/terminals/terminal/shift", envelope, {
            headers: { authorization: "Bearer " + token },
            timeout: 15000,
            validateStatus: () => true,
        });
        console.log(`[shift-sync] ${shiftUuid} → HTTP ${resp.status}`);
        if (resp.status === 200) {
            await shiftModel.update({ shift_send: "SEND" }, { where: { shift_uuid: shiftUuid } });
            return { ok: true };
        }
        return { ok: false, reason: "http_" + resp.status };
    } catch (e) {
        console.log("pushShiftToBackend failed (offline?):", e?.message || e);
        return { ok: false, reason: e?.message || "error" };
    }
}

const DATE_KEYS = ["shift_start", "shift_end"];

// Storno dokument nosi invoice_status 'canceled' i negativan iznos. Originali
// koje je storno pogodio dobivaju 'canceled-orginal' (cijeli račun) ili
// 'canceled-partial' (pojedina karta) — to su i dalje prodajni računi i ne
// smiju se brojati kao povrat.
const isStornoInvoice = (invoice) => (invoice?.invoice_status || '') === 'canceled';

// Oznaka računa kako stoji na samom računu. `invoice_code` je autoritativan —
// za F1 je to "fiskalniBroj/BP/BD", za F2 8-znakovni kod. Fallback slaže F1
// oznaku iz dijelova, za zatečene retke kojima invoice_code nije upisan.
const invoiceLabel = (inv) => {
    if (!inv) return null;
    if (inv.invoice_code) return inv.invoice_code;
    if (inv.invoice_fiskal_no && inv.invoice_business_premise_fiscal_mark && inv.invoice_billing_device_fiscal_mark) {
        return `${inv.invoice_fiskal_no}/${inv.invoice_business_premise_fiscal_mark}/${inv.invoice_billing_device_fiscal_mark}`;
    }
    return inv.invoice_no != null ? String(inv.invoice_no) : null;
};

// Zbirni podaci smjene — isti skup koji mobilna pokazuje u pregledu prije
// zatvaranja.
//
// Raspon "od–do" ide po fiskalnim (F1) računima, jer samo oni čine neprekinutu
// sekvencu NO/PP/NU. F2 računi imaju vlastiti brojač i 8-znakovni kod, pa bi kao
// rub raspona dali besmislicu tipa "VLT2FPMX – 39/ST1/1". Ako smjena nema
// nijedan F1 račun, raspon se slaže od svih računa da polje ne ostane prazno.
const buildShiftTotals = (shiftInvoices) => {
    const rows = shiftInvoices.map((r) => r.dataValues || r);
    const sumBy = (field) => rows.reduce((sum, inv) => sum + Number(inv[field] ?? 0), 0);
    const byNo = (list) => [...list].sort((a, b) => Number(a.invoice_no ?? 0) - Number(b.invoice_no ?? 0));
    const fiscal = byNo(rows.filter((inv) => inv.invoice_fiskal_no != null));
    const range = fiscal.length ? fiscal : byNo(rows);
    return {
        invoice_count: rows.length,
        shift_first_invoice: invoiceLabel(range[0]),
        shift_last_invoice: invoiceLabel(range[range.length - 1]),
        shift_amount: +sumBy('invoice_amount').toFixed(2),
        shift_vat_base: +sumBy('invoice_vat_base').toFixed(2),
        shift_vat: +sumBy('invoice_vat').toFixed(2),
        shift_harbor_tax: +sumBy('invoice_harbor_tax').toFixed(2),
    };
};

// Rekapitulacija storna po sredstvu plaćanja. Storna su već uračunata u ukupan
// promet smjene (negativan iznos ga umanjuje); ovdje se iskazuju zasebno da
// blagajnik vidi koliko je izašlo iz blagajne i po kojem sredstvu. Iznosi se
// prikazuju pozitivno — "vraćeno 25 EUR" se čita lakše od "-25 EUR".
const buildStornoBreakdown = (shiftInvoices) => {
    const byPayment = new Map();
    let count = 0;
    let amount = 0;
    for (const row of shiftInvoices) {
        const inv = row.dataValues || row;
        if (!isStornoInvoice(inv)) continue;
        const value = Math.abs(Number(inv.invoice_amount) || 0);
        count += 1;
        amount += value;
        const uuid = inv.invoice_payment_method_uuid;
        if (!uuid) continue;
        const cur = byPayment.get(uuid) || {
            payment_type_uuid: uuid,
            payment_type_name: inv.invoice_payment_method_name,
            invoice_quantity: 0,
            amount: 0,
        };
        cur.invoice_quantity += 1;
        cur.amount += value;
        byPayment.set(uuid, cur);
    }
    return {
        storno: [...byPayment.values()].map((r) => ({ ...r, amount: +r.amount.toFixed(2) })),
        storno_count: count,
        storno_amount: +amount.toFixed(2),
        ...buildVanjskiStorno(shiftInvoices),
    };
};

// Storno karte prodane na drugom prodajnom mjestu iskazuje se posebno: prihod
// od te karte nikad nije bio u ovoj blagajni, a novac iz nje izlazi. Bez tog
// izdvajanja zaključak izgleda kao da je blagajna vratila vlastitu prodaju, pa
// se manjak ne da objasniti.
const buildVanjskiStorno = (shiftInvoices) => {
    const redci = [];
    let amount = 0;
    for (const row of shiftInvoices) {
        const inv = row.dataValues || row;
        if (!isStornoInvoice(inv)) continue;
        if (!inv.storno_source_channel) continue;
        const value = Math.abs(Number(inv.invoice_amount) || 0);
        amount += value;
        redci.push({
            channel: inv.storno_source_channel,
            channel_type: inv.storno_source_type || '',
            ticket_code: inv.storno_source_ticket_code || '',
            payment_type_name: inv.invoice_payment_method_name || '',
            invoice_label: invoiceLabel(inv),
            amount: +value.toFixed(2),
        });
    }
    return {
        storno_external: redci,
        storno_external_count: redci.length,
        storno_external_amount: +amount.toFixed(2),
    };
};

// Lista smjena per-operater. Više usera može paralelno raditi na desku, pa se
// smjene moraju filtrirati po operater_username — operater vidi samo svoj rad i
// promet. Bez username-a vraća sve (npr. za admin pregled, ako se ikad zatreba).
async function getShiftsDataService(operaterUsername) {
  const where = operaterUsername ? { operater_username: operaterUsername } : {};
  const shifts = await shiftModel.findAll({
    where,
    order: [["id", "DESC"]],
    attributes: { exclude: ["createdAt", "updatedAt"] },
  });

  return {
    shifts: shifts.map((row) => {
      const s = row.toJSON();

      for (const k of DATE_KEYS) {
        if (s[k]) s[k] = new Date(s[k]).toISOString();
      }

      return s;
    }),
  };
}

async function openNewShiftService(data) {
    console.log("DATA U SERVICE ZA OTVARANJE SMJENE:", data);
    const basicData = await companyModel.findOne()
    const newShiftData = {
        shift_uuid: data.shift_uuid,
        client_uuid: basicData.clinet_uuid,
        client_name: basicData.client_name,
        client_address: basicData.client_address,
        client_postal_code: basicData.client_postal_code,
        client_town: basicData.client_town,
        client_country: basicData.client_country,
        client_oib: basicData.client_legal_id,
        business_premise_uuid: basicData.business_premise_uuid,
        business_premise_name: basicData.business_premise_name,
        business_premise_address: basicData.business_premise_address,
        business_premise_postal_code: basicData.business_premise_postal_code || '',
        business_premise_postal_town: basicData.business_premise_town,
        business_premise_fiscal_mark: basicData.business_premise_fiscal_mark,
        billing_device_uuid: basicData.billing_device_uuid,
        billing_device_fiscal_mark: basicData.billing_device_fiscal_mark,
        operater_name: data.operater_name,
        operater_surname: data.operater_surname,
        operater_username: data.operater_username,
        shift_start: new Date(data.shift_start).toISOString()
,
        shift_open: true,
        remark: data.shift_remark
    }
    const openNewShift = await shiftModel.create(newShiftData);
    // Best-effort sync — ako padne, sync će je naknadno pogurati (mirror invoice flow).
    pushShiftToBackend(data.shift_uuid).catch(() => {});
    return openNewShift.toJSON();
}

// Razrada prodanih i storniranih karata po liniji i kategoriji. Računa se iz
// spremljenih računa i karata, pa daje isti rezultat pri zatvaranju smjene i pri
// naknadnom ispisu kopije zaključka.
const buildLineDetails = async (shiftInvoices) => {
    const invoicesUuids = shiftInvoices.map(item => item.invoice_uuid);
    const ordersNumbers = shiftInvoices.map(item => item.order_number);

    const InvoicesItems = await invoiceTransportItemsModel.findAll({
        where: { invoice_uuid: { [Op.in]: invoicesUuids } }
    });
    const shiftTickets = await ticketsModel.findAll({
        where: { order_number: { [Op.in]: ordersNumbers } }
    });
    const distinctLines = InvoicesItems.filter((v, i, a) => a.findIndex(t => (t.line_code === v.line_code)) === i)
    let lineDetails = []
    let deactLineDetails = []
    for (const line of distinctLines) {
        const itemsByLine = InvoicesItems.filter((inv) => inv.line_code === line.line_code)
        const ticketsByLine = shiftTickets.filter((tic) => tic.line_code === line.line_code)
        const ticketsByLineDeact = shiftTickets.filter((tic) => tic.line_code === line.line_code && tic.ticket_deactivate)
        const categoryUuids = ticketsByLine.filter((v, i, a) => a.findIndex(t => (t.ticket_type_uuid === v.ticket_type_uuid)) === i)
        const categoryUuidsDeact = ticketsByLineDeact.filter((v, i, a) => a.findIndex(t => (t.ticket_type_uuid === v.ticket_type_uuid)) === i)
        const sumAmount = () => itemsByLine.reduce((sum, item) => sum + Number(item.item_amount ?? 0), 0);
        let ticketsDetailsByCategory = []
        let deacTicketsDetailsByCategory = []
        for (const categoryUuid of categoryUuids) {
            const ticketsByCategory = ticketsByLine.filter((tic) => tic.ticket_type_uuid === categoryUuid.ticket_type_uuid)
            ticketsDetailsByCategory = [...ticketsDetailsByCategory, {
                category_uuid: categoryUuid.ticket_type_uuid,
                category_name: ticketsByCategory[0].ticket_type_name,
                ticket_quantity: ticketsByCategory.length,
                tickets_amount: ticketsByCategory
                    .map(({ ticket_single_price }) => ticket_single_price)
                    .reduce((sum, i) => sum + i, 0)
            }]
        }
        for (const categoryUuid of categoryUuidsDeact) {
            const ticketsByCategory = ticketsByLineDeact.filter((tic) => tic.ticket_type_uuid === categoryUuid.ticket_type_uuid)
            deacTicketsDetailsByCategory = [...deacTicketsDetailsByCategory, {
                category_uuid: categoryUuid.ticket_type_uuid,
                category_name: ticketsByCategory[0].ticket_type_name,
                ticket_quantity: ticketsByCategory.length,
                tickets_amount: ticketsByCategory
                    .map(({ ticket_single_price }) => ticket_single_price)
                    .reduce((sum, i) => sum + i, 0)
            }]
        }
        if (ticketsDetailsByCategory.length) {
            lineDetails = [...lineDetails, {
                line_code: line.line_code, line_name: line.line_name,
                amount: sumAmount(), tickets_details: ticketsDetailsByCategory,
            }]
        }
        if (deacTicketsDetailsByCategory.length) {
            deactLineDetails = [...deactLineDetails, {
                line_code: line.line_code, line_name: line.line_name,
                amount: sumAmount(), tickets_details: deacTicketsDetailsByCategory,
            }]
        }
    }
    return { lineDetails, deactLineDetails }
}

// Sredstva plaćanja za smjenu. Računi bez payment_method_uuid se preskaču —
// shift_financ ima NOT NULL pa bi bulkCreate srušio zatvaranje smjene.
const buildPaymentSums = (shiftInvoices, shiftUuid) => {
    const invoicesWithPayment = shiftInvoices.filter((v) => !!v.invoice_payment_method_uuid)
    const distinctPayment = invoicesWithPayment.filter((v, i, a) => a.findIndex(t => (t.invoice_payment_method_uuid === v.invoice_payment_method_uuid)) === i)
    return distinctPayment.map((payment) => {
        const invoiceByPayment = invoicesWithPayment.filter((inv) => inv.invoice_payment_method_uuid === payment.invoice_payment_method_uuid)
        return {
            shift_financ_uuid: crypto.randomBytes(16).toString("hex"),
            shift_uuid: shiftUuid,
            payment_type_uuid: payment.invoice_payment_method_uuid,
            payment_type_name: payment.invoice_payment_method_name,
            payment_amount: invoiceByPayment.map(({ invoice_amount }) => invoice_amount).reduce((sum, i) => sum + i, 0),
        }
    })
}

// Cijeli sadržaj zaključka smjene. Koristi ga i zatvaranje i naknadni ispis
// kopije, pa se papir ne može razići ovisno o tome kad je ispisan.
const buildShiftReport = async (shiftUuid) => {
    const shiftData = await shiftModel.findOne({ where: { shift_uuid: shiftUuid } })
    if (!shiftData) return null
    const shiftInvoices = await invoicesModel.findAll({
        where: { shift_uuid: shiftUuid },
        order: [['invoice_payment_method_name', 'ASC']]
    })
    const totals = buildShiftTotals(shiftInvoices)
    const { lineDetails, deactLineDetails } = await buildLineDetails(shiftInvoices)
    return {
        shift: shiftData,
        shift_finance: buildPaymentSums(shiftInvoices, shiftUuid),
        shift_sale: {
            shift_sale_uuid: crypto.randomBytes(16).toString("hex"),
            shift_uuid: shiftUuid,
            amount: totals.shift_amount,
            vat_base: totals.shift_vat_base,
            vat: totals.shift_vat,
            harbor_tax: totals.shift_harbor_tax,
        },
        line_details: lineDetails,
        deacttive_line_detials: deactLineDetails,
        ...totals,
        ...buildStornoBreakdown(shiftInvoices),
    }
}

// Naknadni ispis zaključka zatvorene smjene. Ne mijenja ništa u bazi — samo
// ponovno složi isti izvještaj i pošalje ga na printer, s oznakom KOPIJA.
const reprintShiftService = async (shiftUuid) => {
    try {
        const report = await buildShiftReport(shiftUuid)
        if (!report) return { ok: false, reason: 'smjena nije pronađena' }
        const printed = await shiftPrintHelper({ ...report, copy: true })
        return { ok: !!printed, printed: !!printed }
    } catch (error) {
        console.log('reprintShiftService error:', error?.message || error)
        return { ok: false, reason: error?.message || 'error' }
    }
}

const closeShiftService = async(data) =>{
    try {
        console.log('SHIFT CLOSE CONTROLLER')
        console.log(data)
        const shiftData = await shiftModel.findOne({
            where: {
                shift_uuid: data.shift_uuid,
                shift_open: true
            }
        })
        let dataToSend = {}
        let msgToSend = ''
        let msgSeverity = ''
        if (shiftData) {
            msgToSend = 'Smjena je uspjesšno zatvorena'
            msgSeverity = 'success'
            
            const shiftInvoices = await invoicesModel.findAll({
                where:{
                    shift_uuid:data.shift_uuid
                },order: [['invoice_payment_method_name', 'ASC']]
            })

            // Isti izračun kao u pregledu smjene, da se ekran i ispis poklope.
            //
            // Prvi/zadnji račun se prije slagao kao "invoice_no/BP/BD". Kako je
            // invoice_no kontinuirani brojač svih računa, a fiskalna oznaka nosi
            // invoice_fiskal_no (koji F2 računi preskaču), ta se oznaka nakon
            // prvog F2 računa u smjeni razilazila s onim što piše na računu.
            // Sada se uzima invoice_code sa samog računa.
            const totals = buildShiftTotals(shiftInvoices);
            // Kod automatskog zatvaranja smjena završava u trenutku granice
            // (01:00), a ne kad je aplikacija to primijetila — inače bi smjena
            // ispala duža nego što je stvarno trajala.
            await shiftModel.update({
               shift_end: data.shift_end || new Date(),
               ...(data.remark ? { remark: data.remark } : {}),
               shift_open: false,
               shift_first_invoice: totals.shift_first_invoice,
               shift_last_invoice: totals.shift_last_invoice,
               shift_amount: totals.shift_amount,
               shift_vat_base: totals.shift_vat_base,
               shift_vat: totals.shift_vat,
               shift_harbor_tax: totals.shift_harbor_tax,
               shift_send: null, // resetiraj — closeShift mora ponovo gurnuti backendu
            },{
                where:{
                    shift_uuid:data.shift_uuid
                }
            })
            const paymentSumByMethod = buildPaymentSums(shiftInvoices, shiftData.shift_uuid)
            const { lineDetails, deactLineDetails } = await buildLineDetails(shiftInvoices)
            const shiftSaleData = {
                shift_sale_uuid: crypto.randomBytes(16).toString("hex"),
                shift_uuid: shiftData.shift_uuid,
                amount: totals.shift_amount,
                vat_base: totals.shift_vat_base,
                vat: totals.shift_vat,
                harbor_tax: totals.shift_harbor_tax,
            }

            await shiftFinancModel.bulkCreate(paymentSumByMethod)
            await shiftSaleModel.create(shiftSaleData)
            const shiftToSend =  await shiftModel.findOne({
                where: {
                    shift_uuid: data.shift_uuid,
                }

            })
            // Pridruživanje, ne nova deklaracija — dok je ovdje stajao `const`,
            // vanjski `dataToSend` je ostajao prazan i pozivatelj je uvijek
            // dobivao {} umjesto podataka o zatvorenoj smjeni.
            dataToSend = {
                shift:shiftToSend,
                shift_finance:paymentSumByMethod,
                shift_sale:shiftSaleData,
                line_details:lineDetails,
                deacttive_line_detials:deactLineDetails,
                ...totals,
                ...buildStornoBreakdown(shiftInvoices),
            }
            console.log('SHIFT DATA TO PRINT', dataToSend)
            // Smjena je zatvorena i kad printer zakaže, ali operater to mora
            // saznati — za izvještaj smjene nema naknadnog ispisa kopije.
            // Automatsko zatvaranje ne ispisuje: nitko nije za blagajnom u 01:00,
            // a izvještaj bi ostao na printeru do jutra. Operater ga poslije
            // izvuče kroz ponovni ispis smjene.
            let shiftPrinted = data.automatski ? true : false
            try {
                if (!data.automatski) shiftPrinted = await shiftPrintHelper(dataToSend)
            } catch (printErr) {
                console.log('shiftPrintHelper failed (printer issue?):', printErr?.message || printErr)
            }
            if (!shiftPrinted) {
                msgToSend = 'Smjena je zatvorena, ali izvještaj nije ispisan — provjerite printer.'
                msgSeverity = 'warning'
            }
        }else {
            msgToSend = 'Nije moguće zatvoriti smjenu'
            msgSeverity = 'error'
        }
        // Sync van try-catch bloka da se pokuša gurnuti i kad print/finance koraci
        // padnu — shift je već zatvoren (shift_open: false + agregati) u glavnoj tabeli.
        pushShiftToBackend(data.shift_uuid).catch((e) => {
            console.log('closeShiftService: pushShiftToBackend final catch:', e?.message || e)
        })
        return ({
            msg: msgToSend,
            data: dataToSend,
            severity: msgSeverity
        })
    } catch (error) {
        console.log(error)
    }
}

const shiftSummaryService = async(data)=>{
    try {
        const shiftInvoices = await invoicesModel.findAll({
            where:{
                shift_uuid:data.shift_uuid
            },order: [['invoice_payment_method_name', 'ASC']]
        })
        let paymentSumByMethod = []
        const distinctPayment = shiftInvoices.filter((v, i, a) => a.findIndex(t => (t.invoice_payment_method_uuid === v.invoice_payment_method_uuid)) === i)
        for(const payment of distinctPayment){
            console.log(payment.dataValues.invoice_payment_method_uuid)
            console.log(payment.dataValues.invoice_payment_method_name)
            const invoiceByPayment = shiftInvoices.filter((inv)=>inv.dataValues.invoice_payment_method_uuid === payment.dataValues.invoice_payment_method_uuid)
            console.log(invoiceByPayment.length)
            const paymentSubtotal = invoiceByPayment
          .map(({ invoice_amount }) => invoice_amount)
          .reduce((sum, i) => sum + i, 0);
          const paymentData = {
            payment_type_uuid:payment.dataValues.invoice_payment_method_uuid,
            payment_type_name:payment.dataValues.invoice_payment_method_name,
            invoice_quantity:invoiceByPayment.length,
            amount:paymentSubtotal
          }
          paymentSumByMethod = [...paymentSumByMethod, paymentData]
        }
        return ({
            //invoices:shiftInvoices,
            shift_details:paymentSumByMethod,
            ...buildShiftTotals(shiftInvoices),
            ...buildStornoBreakdown(shiftInvoices),
        })
    } catch (error) {
        console.log(error)
        return ({msg:'error'})
    }
}

// Sync pending smjena: pošalje backendu sve smjene kojima shift_send !== 'SEND'.
// Pozovi pri startu app-a i periodicki — backend je idempotentan po shift_uuid.
async function syncPendingShiftsService() {
    try {
        const pending = await shiftModel.findAll({
            where: {
                [Op.or]: [{ shift_send: null }, { shift_send: { [Op.ne]: "SEND" } }],
            },
            order: [["id", "ASC"]],
        });
        let pushed = 0;
        let failed = 0;
        for (const row of pending) {
            const r = await pushShiftToBackend(row.shift_uuid);
            if (r.ok) pushed++;
            else failed++;
        }
        return { ok: true, total: pending.length, pushed, failed };
    } catch (error) {
        console.log("syncPendingShiftsService error:", error?.message || error);
        return { ok: false, reason: error?.message || "error" };
    }
}


// Smjena se ne smije prenijeti u sljedeći dan: sve što u 01:00 još stoji
// otvoreno zatvara se samo. Granica je zadnji prošli 01:00 — ako je sada
// 00:30, to je jučerašnji, a ako je 07:00, današnji. Time se pokriva i slučaj
// kad je blagajna preko noći bila ugašena: smjena se zatvori pri prvom
// pokretanju, ali s vremenom završetka u 01:00, ne u trenutku pokretanja.
const GRANICA_SAT = 1;

// Prvi 01:00 nakon početka smjene. Granica se veže uz smjenu, ne uz današnji
// dan: blagajna zna biti ugašena danima, a smjena otvorena u ponedjeljak mora
// završiti u utorak u 01:00 — ne u 01:00 onog dana kad se aplikacija upali.
const granicaZatvaranja = (pocetak) => {
    const granica = new Date(pocetak);
    granica.setHours(GRANICA_SAT, 0, 0, 0);
    if (granica <= new Date(pocetak)) granica.setDate(granica.getDate() + 1);
    return granica;
};

const autoCloseShiftsService = async (sada = new Date()) => {
    try {
        const otvorene = await shiftModel.findAll({ where: { shift_open: true } });
        const zaostale = otvorene
            .map((s) => ({ smjena: s, granica: granicaZatvaranja(s.shift_start) }))
            .filter((x) => x.granica <= sada);
        if (!zaostale.length) return { closed: 0 };

        for (const { smjena, granica } of zaostale) {
            console.log(`[shift-auto] zatvaram ${smjena.shift_uuid} (otvorena ${smjena.shift_start}) na ${granica.toISOString()}`);
            await closeShiftService({
                shift_uuid: smjena.shift_uuid,
                shift_end: granica,
                automatski: true,
                remark: 'Automatski zatvorena u 01:00',
            });
        }
        return { closed: zaostale.length };
    } catch (error) {
        console.log('autoCloseShiftsService error:', error?.message || error);
        return { closed: 0, error: error?.message || 'error' };
    }
};

module.exports = {
    getShiftsDataService,
    autoCloseShiftsService,
    granicaZatvaranja,
    openNewShiftService,
    closeShiftService,
    shiftSummaryService,
    reprintShiftService,
    syncPendingShiftsService,
};