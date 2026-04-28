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

            const invoiceWithMinInvNo = shiftInvoices.length
                ? shiftInvoices.reduce((min, current) =>
                    current.invoice_no < min.invoice_no ? current : min
                    )
            : null;
            const invoiceWithMaxInvNo = shiftInvoices.length
                ? shiftInvoices.reduce((max, current) =>
                    current.invoice_no > max.invoice_no ? current : max
                    )
            : null;

            // Agregati za prikaz na portalu (ukupno, osnovica, PDV, lučka pristojba)
            const sumByField = (field) => shiftInvoices.reduce((sum, item) => sum + Number(item[field] ?? 0), 0);
            await shiftModel.update({
               shift_end:new Date(),
               shift_open: false,
               shift_first_invoice:invoiceWithMinInvNo ? invoiceWithMinInvNo.invoice_no +'/'+ invoiceWithMinInvNo.invoice_business_premise_fiscal_mark + '/'+ invoiceWithMinInvNo.invoice_billing_device_fiscal_mark: null,
               shift_last_invoice:invoiceWithMaxInvNo ? invoiceWithMaxInvNo.invoice_no +'/'+ invoiceWithMaxInvNo.invoice_business_premise_fiscal_mark + '/'+ invoiceWithMaxInvNo.invoice_billing_device_fiscal_mark : null,
               shift_amount: sumByField('invoice_amount'),
               shift_vat_base: sumByField('invoice_vat_base'),
               shift_vat: sumByField('invoice_vat'),
               shift_harbor_tax: sumByField('invoice_harbor_tax'),
               shift_send: null, // resetiraj — closeShift mora ponovo gurnuti backendu
            },{
                where:{
                    shift_uuid:data.shift_uuid
                }
            })
            let paymentSumByMethod = []
                // Filtriraj invoice-e bez payment_method_uuid — shift_financ ima NOT NULL
                // constraint pa bulkCreate baci constraint error i ruši close transakciju.
                const invoicesWithPayment = shiftInvoices.filter((v) => !!v.invoice_payment_method_uuid)
                const distinctPayment = invoicesWithPayment.filter((v, i, a) => a.findIndex(t => (t.invoice_payment_method_uuid === v.invoice_payment_method_uuid)) === i)
                for(const payment of distinctPayment){
                    console.log(payment.dataValues.invoice_payment_method_uuid)
                    console.log(payment.dataValues.invoice_payment_method_name)
                    const invoiceByPayment = invoicesWithPayment.filter((inv)=>inv.dataValues.invoice_payment_method_uuid === payment.dataValues.invoice_payment_method_uuid)
                    console.log(invoiceByPayment.length)
                    const paymentSubtotal = invoiceByPayment
                .map(({ invoice_amount }) => invoice_amount)
                .reduce((sum, i) => sum + i, 0);
                const paymentData = {
                    shift_financ_uuid:crypto.randomBytes(16).toString("hex"),
                    shift_uuid:shiftData.shift_uuid,
                    payment_type_uuid:payment.dataValues.invoice_payment_method_uuid,
                    payment_type_name:payment.dataValues.invoice_payment_method_name,
                    payment_amount:paymentSubtotal
                }
                paymentSumByMethod = [...paymentSumByMethod, paymentData]
            }

            const invoicesUuids = shiftInvoices.map(item => item.invoice_uuid);
            const ordersNumbers = shiftInvoices.map(item => item.order_number);

            const InvoicesItems = await invoiceTransportItemsModel.findAll({
                where: {
                    invoice_uuid: {
                    [Op.in]: invoicesUuids
                    }
                }
            });
            const shiftTickets = await ticketsModel.findAll({
                where: {
                    order_number: {
                    [Op.in]: ordersNumbers
                    }
                }
            });
            const distinctLines = InvoicesItems.filter((v, i, a) => a.findIndex(t => (t.line_code === v.line_code)) === i)
            let lineDetails = []
            let deactLineDetails = []
            for(const line of distinctLines){
                const itemsByLine = InvoicesItems.filter((inv)=>inv.line_code === line.line_code)
                const ticketsByLine = shiftTickets.filter((tic)=>tic.line_code === line.line_code )
                const ticketsByLineDeact = shiftTickets.filter((tic)=>tic.line_code === line.line_code && tic.ticket_deactivate)
                const categoryUuids = ticketsByLine.filter((v, i, a) => a.findIndex(t => (t.ticket_type_uuid === v.ticket_type_uuid)) === i)
                const categoryUuidsDeact = ticketsByLineDeact.filter((v, i, a) => a.findIndex(t => (t.ticket_type_uuid === v.ticket_type_uuid)) === i)
                const sumAmount = () => itemsByLine.reduce((sum, item) => sum + Number(item.item_amount ?? 0), 0);
                let ticketsDetailsByCategory = []
                let deacTicketsDetailsByCategory = []
                for(const categoryUuid of categoryUuids){
                    const ticketsByCategory = ticketsByLine.filter((tic)=>tic.ticket_type_uuid === categoryUuid.ticket_type_uuid)
                    const categoryTicketData = {
                        category_uuid:categoryUuid.ticket_type_uuid,
                        category_name:ticketsByCategory[0].ticket_type_name,
                        ticket_quantity:ticketsByCategory.length,
                        tickets_amount:ticketsByCategory
                        .map(({ ticket_single_price }) => ticket_single_price)
                        .reduce((sum, i) => sum + i, 0)
                    }
                    ticketsDetailsByCategory = [...ticketsDetailsByCategory, categoryTicketData]
                }
                if(ticketsByLineDeact.length > 0){
                    console.log('IMA STORNIRANIH KARATA ZA LINIJU ' + ticketsByLineDeact)
                    for(const categoryUuid of categoryUuidsDeact){
                        const ticketsByCategory = ticketsByLineDeact.filter((tic)=>tic.ticket_type_uuid === categoryUuid.ticket_type_uuid)
                        const categoryTicketData = {
                            category_uuid:categoryUuidsDeact.ticket_type_uuid,
                            category_name:ticketsByCategory[0].ticket_type_name,
                            ticket_quantity:ticketsByCategory.length,
                            tickets_amount:ticketsByCategory
                            .map(({ ticket_single_price }) => ticket_single_price)
                            .reduce((sum, i) => sum + i, 0)
                        }
                        deacTicketsDetailsByCategory = [...deacTicketsDetailsByCategory, categoryTicketData]
                    }
                }
                if(ticketsDetailsByCategory.length){
                    const lineNewDetail = {
                        line_code:line.line_code,
                        line_name:line.line_name,
                        amount: sumAmount(),
                        tickets_details: ticketsDetailsByCategory,
                        
                    }
                    lineDetails = [...lineDetails, lineNewDetail]
                }
                if(deacTicketsDetailsByCategory.length){
                    const lineNewDetail = {
                        line_code:line.line_code,
                        line_name:line.line_name,
                        amount: sumAmount(),
                        tickets_details: deacTicketsDetailsByCategory,
                        
                    }
                    deactLineDetails = [...deactLineDetails, lineNewDetail]
                }
            }

            const shiftSaleData = {
                shift_sale_uuid: crypto.randomBytes(16).toString("hex"),
                shift_uuid: shiftData.shift_uuid,
                amount: sumByField('invoice_amount'),
                vat_base: sumByField('invoice_vat_base'),
                vat: sumByField('invoice_vat'),
                harbor_tax: sumByField('invoice_harbor_tax'),
            }


            await shiftFinancModel.bulkCreate(paymentSumByMethod)
            await shiftSaleModel.create(shiftSaleData)
            const shiftToSend =  await shiftModel.findOne({
                where: {
                    shift_uuid: data.shift_uuid,
                }

            })
            const dataToSend = {
                shift:shiftToSend,
                shift_finance:paymentSumByMethod,
                shift_sale:shiftSaleData,
                line_details:lineDetails,
                deacttive_line_detials:deactLineDetails
            }
            console.log('SHIFT DATA TO PRINT', dataToSend)
            try {
                await shiftPrintHelper(dataToSend)
            } catch (printErr) {
                console.log('shiftPrintHelper failed (printer issue?):', printErr?.message || printErr)
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
            shift_details:paymentSumByMethod
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

module.exports = {
    getShiftsDataService,
    openNewShiftService,
    closeShiftService,
    shiftSummaryService,
    syncPendingShiftsService,
};