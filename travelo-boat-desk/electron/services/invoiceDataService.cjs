const crypto = require("crypto");
const axios = require('axios');
const { pairingDataModel } = require("../db/models/Pairing.cjs");
const { companyModel, usersModel } = require("../db/models/BasicData.cjs");
const { shiftModel } = require("../db/models/ShiftsData.cjs");
const { invoicesModel, invoiceTransportItemsModel } = require("../db/models/InvoicesData.cjs");
const { ticketsGroupsModel, ticketsModel } = require("../db/models/TicketsData.cjs");
const { invoicePrintHelper, cancelInvoicePrint, copyInvoicePrint, copyAllTickets } = require("../helpers/printHelpers/invoicePrintHelper.cjs");
const { systemSettingsDataModel } = require("../db/models/Settings.cjs");


const INV_DATE_KEYS = ["invoice_date"];

async function getInvoicesDataService(){
    const invoices = await invoicesModel.findAll({
    order: [["id", "DESC"]],
    attributes: { exclude: ["createdAt", "updatedAt"] },
  });

  return {
    invoices: invoices.map((row) => {
      const s = row.toJSON();

      for (const k of INV_DATE_KEYS) {
        if (s[k]) s[k] = new Date(s[k]).toISOString();
      }

      return s;
    }),
  }
}

async function getInvoiceDataService(data){
    const invoiceData = await invoicesModel.findOne({
      where:{
        order_number:data
      },
    order: [["id", "DESC"]],
    attributes: { exclude: ["createdAt", "updatedAt"] },
  });

  return {
    invoice: invoiceData ? invoiceData.toJSON() : null,
  }
}

async function getInvoicesDetailsDataService(data){
  console.log(data)
    const invoiceData = await invoicesModel.findOne({
      where:{
        invoice_uuid:data
      },
      order: [["id", "DESC"]],
      attributes: { exclude: ["createdAt", "updatedAt"] },
    });
    const invoiceItems = await invoiceTransportItemsModel.findAll({
      where:{
        invoice_uuid:data
      },
      order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }
    })
    const ticketsGroups = await ticketsGroupsModel.findAll({
      where:{
        order_number:invoiceData.order_number
      },
      order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }
    })
    let itemsToSend = []
    for(const item of invoiceItems){
      const groupsForItem = ticketsGroups.filter((group)=> group.item_uuid === item.item_uuid)
      const newItem = {
        ...item.toJSON(),
        tickets_group: groupsForItem.map(g => g.toJSON?.() ?? g)
      };
      itemsToSend = [...itemsToSend, newItem]
    }
  return {
    invoice_items: itemsToSend
  }
}

// Boat-desk pattern (kao Sunmi mobile): autoritet za fiskalnu numeraciju je LOKALNA
// SQLite baza. Boat-desk owns svoj billing_device pa lokalni counter ne kolizira s
// drugim kanalima. Mora raditi offline pa POST backendu je best-effort — invoice se
// uvijek prvo perzistira lokalno (s autoritativnim brojevima), a invoice_send='SEND'
// se postavi tek kad backend potvrdi. Pending računi se naknadno sinkroniziraju.
//
// Numeracija per (godina × billing_device_uuid):
//   • invoice_no — kontinuirano za F1 i F2 (HR fisk)
//   • invoice_fiskal_no — sekvenca samo za F1; F2 ima NULL
//   • invoice_code — "${invoice_fiskal_no}/${BP_mark}/${BD_mark}" za F1;
//                    8-znakovni random kod za F2 (vidljivi "Račun br", jer F2
//                    nema F1 fiskalnu strukturu)
//
// F2 se okida ISKLJUČIVO kad operater označi F2 fiskalizaciju uz R1 kupca —
// isto kao na mobilnoj blagajni (`buyer.f2_required`). R1 bez te oznake je
// običan F1 račun koji nosi podatke o kupcu; samo OIB kupca NIJE dovoljan.
// Postavljeni početak numeracije (preseljenje na drugo računalo) vrijedi kao
// DONJA GRANICA i samo za godinu u kojoj je postavljen. Čim lokalni računi
// prijeđu tu brojku, granica nema učinka — pa ne može uzrokovati duplikat, niti
// spriječiti godišnji reset na 1.
const applyFloor = (next, floor, year, floorYear) => {
  if (!floor || !floorYear) return next
  if (Number(floorYear) !== Number(year)) return next
  return Math.max(next, Number(floor) || 0)
}

const nextInvoiceNoLocal = async (year, billingDeviceUuid, settings) => {
  const max = await invoicesModel.max('invoice_no', {
    where: { invoice_year: year, invoice_billing_device_uuid: billingDeviceUuid },
  })
  const next = Number.isFinite(max) ? max + 1 : 1
  return applyFloor(next, settings?.next_invoice_no, year, settings?.next_invoice_year)
}
const nextInvoiceFiskalNoLocal = async (year, billingDeviceUuid, settings) => {
  const max = await invoicesModel.max('invoice_fiskal_no', {
    where: { invoice_year: year, invoice_billing_device_uuid: billingDeviceUuid },
  })
  const next = Number.isFinite(max) ? max + 1 : 1
  return applyFloor(next, settings?.next_invoice_fiskal_no, year, settings?.next_invoice_year)
}
// Trenutno stanje brojača — za prikaz u postavkama, da se početak numeracije ne
// upisuje naslijepo. Vraća i broj koji bi sljedeći račun stvarno dobio (dakle
// nakon primjene donje granice) i broj koji proizlazi samo iz lokalnih računa.
const getNextInvoiceNumbersService = async () => {
  try {
    const settings = await systemSettingsDataModel.findOne()
    const basicData = await companyModel.findOne()
    const year = new Date().getFullYear()
    const bd = basicData?.billing_device_uuid
    const maxNo = await invoicesModel.max('invoice_no', {
      where: { invoice_year: year, invoice_billing_device_uuid: bd },
    })
    const maxFiskalNo = await invoicesModel.max('invoice_fiskal_no', {
      where: { invoice_year: year, invoice_billing_device_uuid: bd },
    })
    const izLokalnih = Number.isFinite(maxNo) ? maxNo + 1 : 1
    const izLokalnihFiskal = Number.isFinite(maxFiskalNo) ? maxFiskalNo + 1 : 1
    return {
      year,
      // Ono što će sljedeći račun stvarno dobiti.
      next_invoice_no: applyFloor(izLokalnih, settings?.next_invoice_no, year, settings?.next_invoice_year),
      next_invoice_fiskal_no: applyFloor(izLokalnihFiskal, settings?.next_invoice_fiskal_no, year, settings?.next_invoice_year),
      // Ono što proizlazi samo iz lokalnih računa, bez postavljene granice.
      from_local_no: izLokalnih,
      from_local_fiskal_no: izLokalnihFiskal,
      // Postavljena granica i godina za koju vrijedi.
      floor_no: settings?.next_invoice_no ?? null,
      floor_fiskal_no: settings?.next_invoice_fiskal_no ?? null,
      floor_year: settings?.next_invoice_year ?? null,
      business_premise_fiscal_mark: basicData?.business_premise_fiscal_mark || '',
      billing_device_fiscal_mark: basicData?.billing_device_fiscal_mark || '',
    }
  } catch (error) {
    console.log('getNextInvoiceNumbersService error:', error?.message || error)
    return { error: error?.message || 'error' }
  }
}

// Alfabet bez 0/O/1/I — kod se čita s papira i prepisuje rukom. Identičan
// generator kao na mobilnoj (localSale.js), da F2 kodovi izgledaju isto bez
// obzira na kojoj je blagajni račun izdan.
const ALPHA32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const randomInvoiceCodeF2 = () => {
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHA32[crypto.randomInt(0, ALPHA32.length)]
  return s
}
const buildInvoiceCode = (isF2, fiskalNo, bpMark, bdMark) => {
  if (isF2) {
    // F2 nema strukturu fiskalni_broj/BP/BD — vidljivi "Račun br" je ovaj kod.
    return randomInvoiceCodeF2()
  }
  return (fiskalNo && bpMark && bdMark) ? `${fiskalNo}/${bpMark}/${bdMark}` : null
}

// Je li račun F2, gledano iz već spremljenog računa (storno, kopija ispisa).
// Stariji računi nemaju `is_f2` — tada vrijedi `fiskal_required`, koji je do
// sada nosio istu ulogu, pa ni jedan zatečeni R1 ne mijenja tip.
const invoiceIsF2 = (invoice) => {
  if (!invoice) return false
  if (invoice.is_f2 != null) return !!invoice.is_f2
  if (invoice.fiskal_required != null) return !!invoice.fiskal_required
  return !!invoice.buyer_oib
}

const createInvoiceService = async ({ user, items, payment, buyer, paymentData }) => {
  try {
    const pairingDAta = await pairingDataModel.findOne();
    const token = pairingDAta.token;

    let buyerData = {}
    if(buyer){
      buyerData = buyer
    }
    const settingsData = await systemSettingsDataModel.findOne()
    const basicData = await companyModel.findOne()
    const invoiceUUID = crypto.randomBytes(16).toString("hex")
    const orderUUID = crypto.randomBytes(16).toString("hex")
    // Invoice MORA pripasti OTVORENOJ smjeni tog usera. Bez shift_open: true
    // bismo riskirali da račun završi u zatvorenoj prošloj smjeni (npr. ako user
    // nije otvorio novu) — to kvari obračun rada svakog operatera.
    const shiftData = await shiftModel.findOne({
      where: {
        operater_username: user.user_username,
        shift_open: true,
      },
      order: [['id', 'DESC']],
    })
    if (!shiftData) {
      throw new Error(`Operater ${user.user_username} nema otvorenu smjenu — račun se ne može izdati.`)
    }
    const userData = await usersModel.findOne({
      where: {
        user_username: user.user_username
      }
    })
    let itemData = []
    let ticketsGroupData = []
    let ticketsData = []

    let ticktStatus = 'ISSUED'
      if(settingsData.auto_validate){
        ticktStatus = 'VALIDATE'
    }

    for (const item of items) {
      const itemUUID = crypto.randomBytes(16).toString("hex")
      let newTicketGroup = []
      for (const ticketGroup of item.ticketsData) {
        const newGroup = {
          ticket_group_uuid: ticketGroup.ticket_group_uuid,
          ticket_type_name: ticketGroup.ticket_type_name,
          ticket_type_id: ticketGroup.ticket_type_id,
          ticket_type_uuid: ticketGroup.ticket_type_uuid,
          sales_route_uuid: item.sales_route_uuid,
          single_price: ticketGroup.single_price,
          total_price: ticketGroup.total_price,
          total_vat_base: ticketGroup.total_vat_base,
          total_vat: ticketGroup.total_vat,
          total_harbor_tax: ticketGroup.total_harbor_tax,
          shift_uuid: shiftData.shift_uuid,
          order_number: orderUUID,
          item_uuid: itemUUID,
          quantity: ticketGroup.quantity,
        }
        newTicketGroup = [...newTicketGroup, newGroup]
        ticketsGroupData = [...ticketsGroupData, newGroup]

        for (let i = 0; i < ticketGroup.quantity; i++) {
          const newTicket = {
            ticket_uuid: crypto.randomBytes(16).toString("hex"),
            ticket_code: crypto.randomBytes(6).toString("hex"),
            ticket_group_uuid: ticketGroup.ticket_uuid,
            ticket_type_name: ticketGroup.ticket_type_name,
            ticket_type_uuid: ticketGroup.ticket_type_uuid,
            ticket_single_price: ticketGroup.single_price,
            ticket_is_active: true,
            ticket_is_canceled: false,
            sales_route_uuid: item.sales_route_uuid,
            ticket_departure_planed: item.departure,
            ticket_departure: item.departure,
            line_code: item.line_code,
            line_name: item.line_name,
            ticket_departure_harbor_id: item.departure_harbor_id,
            ticket_departure_harbor_name: item.departure_harbor_name,
            ticket_arrival_planed: item.arrival,
            ticket_arrival: item.arrival,
            ticket_arrival_harbor_id: item.arrival_harbor_id,
            ticket_arrival_harbor_name: item.arrival_harbor_name,
            ticket_deactivate:false,
            shift_uuid: shiftData.shift_uuid,
            order_number: orderUUID,
            order_item_uuid:ticketGroup.ticket_uuid,
            ticket_status: ticktStatus,
            card_data:ticketGroup.card_data
          }
          ticketsData = [...ticketsData, newTicket]
        }
      }
      const itemAmount = newTicketGroup
          .map(({ total_price }) => total_price)
          .reduce((sum, i) => sum + i, 0);
      const itemVatBase = newTicketGroup
          .map(({ total_vat_base }) => total_vat_base)
          .reduce((sum, i) => sum + i, 0);
      const itemVat = newTicketGroup
          .map(({ total_vat }) => total_vat)
          .reduce((sum, i) => sum + i, 0);
      const itemHarborFee = newTicketGroup
          .map(({ total_harbor_tax }) => total_harbor_tax)
          .reduce((sum, i) => sum + i, 0);

      const newItem = {
        item_uuid: itemUUID,
        invoice_uuid: invoiceUUID,
        sales_route_uuid: item.sales_route_uuid,
        line_code: item.line_code,
        line_name: item.line_name,
        departure: item.departure,
        departure_harbor_id: item.departure_harbor_id,
        departure_harbor_name: item.departure_harbor_name,
        arrival: item.arrival,
        arrival_harbor_id: item.arrival_harbor_id,
        arrival_harbor_name: item.arrival_harbor_name,
        item_amount:itemAmount,
        item_vat_base:itemVatBase,
        item_vat:itemVat,
        item_harbor_fee:itemHarborFee,
        shift_uuid: shiftData.shift_uuid,
        order_number: orderUUID,
        tickets_group: newTicketGroup,
      }
      itemData = [...itemData, newItem]
    }

    // Lokalno dodjeljivanje fiskalne numeracije (autoritet je boat-desk; mora
    // raditi offline). invoice_no kontinuirano F1+F2; invoice_fiskal_no samo F1.
    // R1 = račun nosi podatke o kupcu. F2 = R1 koji uz to ide u HRFISK20
    // fiskalizaciju i kupcu se dostavlja kao e-račun. To su dvije odvojene
    // odluke; F2 bez OIB-a ne postoji, ali R1 bez F2 postoji i ostaje F1.
    const isR1 = !!buyerData.buyer_vat_id;
    const isF2 = isR1 && !!buyerData.f2_required;
    const invoiceYear = new Date().getFullYear();
    const billingDeviceUuid = basicData.billing_device_uuid;
    const invoiceNo = await nextInvoiceNoLocal(invoiceYear, billingDeviceUuid, settingsData);
    const invoiceFiskalNo = isF2 ? null : await nextInvoiceFiskalNoLocal(invoiceYear, billingDeviceUuid, settingsData);
    const invoiceCode = buildInvoiceCode(isF2, invoiceFiskalNo, basicData.business_premise_fiscal_mark, basicData.billing_device_fiscal_mark);

    const invoiceSubtotal = itemData
        .map(({ item_amount }) => item_amount)
        .reduce((sum, i) => sum + i, 0);
    const invoiceVatBase = itemData
        .map(({ item_vat_base }) => item_vat_base)
        .reduce((sum, i) => sum + i, 0);
    const invoiceVat = itemData
        .map(({ item_vat }) => item_vat)
        .reduce((sum, i) => sum + i, 0);
    const invoiceHarborFee = itemData
        .map(({ item_harbor_fee }) => item_harbor_fee)
        .reduce((sum, i) => sum + i, 0);

    const invoiceToAdd = {
      invoice_uuid: invoiceUUID,
      invoice_no: invoiceNo,
      invoice_fiskal_no: invoiceFiskalNo,
      invoice_code: invoiceCode,
      fiskal_required: isF2,
      is_f2: isF2,
      invoice_year: invoiceYear,
      invoice_date: new Date(),
      invoice_client_uuid: basicData.clinet_uuid,
      invoice_client_name: basicData.client_name,
      invoice_client_address: basicData.client_address,
      invoice_client_postal_code: basicData.client_postal_code,
      invoice_client_town: basicData.client_town,
      invoice_client_country: basicData.client_country,
      invoice_client_oib: basicData.client_legal_id,
      invoice_business_premise_uuid: basicData.business_premise_uuid,
      invoice_business_premise_name: basicData.business_premise_name,
      invoice_business_premise_address: basicData.business_premise_address,
      invoice_business_premise_postal_code: basicData.business_premise_postal_code || '',
      invoice_business_premise_postal_town: basicData.business_premise_town,
      invoice_business_premise_fiscal_mark: basicData.business_premise_fiscal_mark,
      invoice_billing_device_uuid: basicData.billing_device_uuid,
      invoice_billing_device_fiscal_mark: basicData.billing_device_fiscal_mark,
      invoice_is_pay: true,
      invoice_payment_data_uuid: 'keš',
      invoice_ZKI: "",
      invoice_operator_name: userData.user_name + ' ' + userData.user_surname,
      invoice_operator_id: userData.id,
      invoice_operator_uuid: userData.user_uuid,
      invoice_operator_mark: userData.user_mark,
      invoice_payment_method_uuid: payment.uuid,
      invoice_payment_method_name: payment.name,
      invoice_payment_method_fiscal_mark: payment.payment_type_acr,
      order_number: orderUUID,
      buyer_uuid: buyerData.buyer_uuid || '',
      buyer_name: buyerData.buyer_name || '',
      buyer_email: buyerData.buyer_email || '',
      buyer_tel: buyerData.buyer_tel || '',
      buyer_company_name: buyerData.buyer_company_name || '',
      buyer_address: buyerData.buyer_address || '',
      buyer_oib: buyerData.buyer_vat_id || '',
      buyer_postal_code: buyerData.buyer_postal_code || '',
      buyer_town: buyerData.buyer_town || '',
      buyer_country: buyerData.buyer_country || '',
      shift_uuid: shiftData.shift_uuid,
      invoice_status: 'issued',
      invoice_canceled: false,
      invoice_amount: invoiceSubtotal,
      invoice_vat_base: invoiceVatBase,
      invoice_vat: invoiceVat,
      invoice_harbor_tax: invoiceHarborFee,
      invoice_items: itemData,
      payment_data: paymentData || {},
    };

    // 1) Lokalna baza ALWAYS — racun mora postojati makar backend bude nedostupan.
    await invoicesModel.create(invoiceToAdd)
    await invoiceTransportItemsModel.bulkCreate(itemData)
    await ticketsGroupsModel.bulkCreate(ticketsGroupData)
    await ticketsModel.bulkCreate(ticketsData);

    // 2) Print s lokalnim autoritativnim brojem. Print fail ne smije prekinuti
    // backend POST ni booking refresh — printer je opcionalni periferiji.
    const invoiceData = {
      basic_data: basicData,
      invoice: invoiceToAdd,
      tickets_groups: ticketsGroupData,
      items: itemData,
      tickets: ticketsData,
    }
    // Ishod ispisa se vraća pozivatelju da operater vidi ako karta nije izašla —
    // račun je već izdan i ne smije se prekidati, ali šutnja je gore od upozorenja.
    let printResult = { invoice: false, tickets: false }
    try {
      printResult = await invoicePrintHelper(invoiceData) || printResult
    } catch (printErr) {
      console.log('invoicePrintHelper failed (printer issue?):', printErr?.message || printErr)
    }

    // 3) Backend POST — best-effort. Ako padne, invoice ostaje pending i sync
    // (syncPendingInvoicesService) će ga naknadno gurnuti.
    try {
      const sendInvoice = await axios.post(settingsData.backend_url + '/terminals/terminal/add_invoices', invoiceData, {
        headers: { authorization: 'Bearer ' + token },
        timeout: 15000,
      })
      if (sendInvoice.status === 200) {
        await invoicesModel.update({ invoice_send: 'SEND' }, { where: { invoice_uuid: invoiceUUID } })
      }
    } catch (e) {
      console.log('add_invoices backend POST failed (offline?), ostaje pending:', e?.message || e)
    }
    return { invoice_uuid: invoiceUUID, print: printResult }
  } catch (error) {
    console.log('createInvoiceService error:', error?.message || error)
  }
}

const cancelInvoiceService = async ({invoice, user, payment, paymentData, stornoPct }) => {
  try {
    // Postotak povrata bira blagajnik iz šifarnika. Bez njega — stariji poziv ili
    // prazan šifarnik — vraća se puni iznos, kako je radilo i prije. Svaki iznos
    // se zaokružuje na cent zasebno, da zbroj stavki odgovara iznosu računa.
    const stornoFactor = Number.isFinite(Number(stornoPct)) && Number(stornoPct) > 0
        ? Math.min(100, Number(stornoPct)) / 100
        : 1;
    const basicData = await companyModel.findOne()
    const pairingDAta = await pairingDataModel.findOne();
    const settingsData = await systemSettingsDataModel.findOne();
    const token = pairingDAta.token;
    const backendUrl = settingsData?.backend_url;
    const invoiceData = await invoicesModel.findOne({
      where:{
        invoice_uuid:invoice.invoice_uuid
      }
    })
    // Zadnja brana protiv dvostrukog storna. Sučelje gasi gumb, ali provjera
    // mora stajati i ovdje — storno računa je nepovratan i dva storna za istu
    // prodaju razbiju obračun smjene i fiskalnu sliku.
    if (!invoiceData) {
      return { ok: false, error: { message: 'Račun nije pronađen.' } }
    }
    if (['canceled', 'canceled-orginal', 'canceled-partial'].includes(invoiceData.invoice_status)) {
      console.log('cancelInvoiceService: račun je već storniran —', invoiceData.invoice_status)
      return { ok: false, error: { message: 'Račun je već storniran i ne može se stornirati ponovno.' } }
    }
    const itemsForInvoice = await invoiceTransportItemsModel.findAll({
      where:{
        order_number:invoiceData.order_number
      }

    })
    const ticketsGroupForInvoice = await ticketsGroupsModel.findAll({
      where:{
        order_number:invoiceData.order_number
      }

    })
    const invoiceUUID = crypto.randomBytes(16).toString("hex")
    const orderUUID = crypto.randomBytes(16).toString("hex")
    // Invoice MORA pripasti OTVORENOJ smjeni tog usera. Bez shift_open: true
    // bismo riskirali da račun završi u zatvorenoj prošloj smjeni (npr. ako user
    // nije otvorio novu) — to kvari obračun rada svakog operatera.
    const shiftData = await shiftModel.findOne({
      where: {
        operater_username: user.user_username,
        shift_open: true,
      },
      order: [['id', 'DESC']],
    })
    if (!shiftData) {
      throw new Error(`Operater ${user.user_username} nema otvorenu smjenu — račun se ne može izdati.`)
    }
    // Lokalna numeracija (autoritet je boat-desk; mora raditi offline).
    // Storno prati tip izvornog računa — storno F2 računa je F2, storno običnog
    // R1 računa ide u F1 sekvencu kao i original.
    const isF2 = invoiceIsF2(invoiceData);
    const invoiceYear = new Date().getFullYear();
    const billingDeviceUuid = invoiceData.invoice_billing_device_uuid;
    const invoiceNo = await nextInvoiceNoLocal(invoiceYear, billingDeviceUuid, settingsData);
    const invoiceFiskalNo = isF2 ? null : await nextInvoiceFiskalNoLocal(invoiceYear, billingDeviceUuid, settingsData);
    const invoiceCode = buildInvoiceCode(isF2, invoiceFiskalNo, invoiceData.invoice_business_premise_fiscal_mark, invoiceData.invoice_billing_device_fiscal_mark);

    let itemsToAdd = []
    let ticketsGroupToAdd = []

    for(const item of itemsForInvoice){
      const groupsForItem = ticketsGroupForInvoice.filter((group)=>group.item_uuid === item.item_uuid)
      const itemUUID = crypto.randomBytes(16).toString("hex")
      let groupForItem = []
      for(const group of groupsForItem){
            const newGroup = {
              ticket_group_uuid: group.ticket_group_uuid,
              ticket_type_name: group.ticket_type_name,
              ticket_type_id: group.ticket_type_id,
              ticket_type_uuid: group.ticket_type_uuid,
              sales_route_uuid: group.sales_route_uuid,
              single_price: +(Number(group.single_price) * stornoFactor).toFixed(2),
              total_price: +(Number(group.total_price) * stornoFactor).toFixed(2),
              total_vat_base: +(Number(group.total_vat_base) * stornoFactor).toFixed(2),
              total_vat: +(Number(group.total_vat) * stornoFactor).toFixed(2),
              total_harbor_tax: +(Number(group.total_harbor_tax) * stornoFactor).toFixed(2),
              shift_uuid: shiftData.shift_uuid,
              order_number: orderUUID,
              item_uuid: itemUUID,
              quantity: group.quantity,
          }
          groupForItem = [...groupForItem, newGroup]
          ticketsGroupToAdd = [...ticketsGroupToAdd, newGroup]
      }
      const newItem = {
        item_uuid: itemUUID,
        invoice_uuid: invoiceUUID,
        sales_route_uuid: item.sales_route_uuid,
        line_code: item.line_code,
        line_name: item.line_name,
        departure: item.departure,
        departure_harbor_id: item.departure_harbor_id,
        departure_harbor_name: item.departure_harbor_name,
        arrival: item.arrival,
        arrival_harbor_id: item.arrival_harbor_id,
        arrival_harbor_name: item.arrival_harbor_name,
        item_amount:+(Number(item.item_amount) * stornoFactor).toFixed(2) * -1,
        item_vat_base:+(Number(item.item_vat_base) * stornoFactor).toFixed(2) * -1,
        item_vat:+(Number(item.item_vat) * stornoFactor).toFixed(2) * -1,
        item_harbor_fee:+(Number(item.item_harbor_fee) * stornoFactor).toFixed(2) * -1,
        shift_uuid: shiftData.shift_uuid,
        order_number: orderUUID,
        tickets_group: groupForItem,
        }
        
      itemsToAdd = [...itemsToAdd, newItem]
    }

    // Storno R1 račun nasljeđuje OIB iz originala — bez podataka o kupcu
    // storno ne bi bio uparen s računom koji ispravlja.
    const invoiceToAdd = {
      invoice_uuid: invoiceUUID,
      invoice_no: invoiceNo,
      invoice_fiskal_no: invoiceFiskalNo,
      invoice_code: invoiceCode,
      fiskal_required: isF2,
      is_f2: isF2,
      invoice_year: invoiceYear,
      invoice_date: new Date(),
      invoice_client_uuid: invoiceData.invoice_client_uuid,
      invoice_client_name: invoiceData.invoice_client_name,
      invoice_client_address: invoiceData.invoice_client_address,
      invoice_client_postal_code: invoiceData.invoice_client_postal_code,
      invoice_client_town: invoiceData.invoice_client_town,
      invoice_client_country: invoiceData.invoice_client_country,
      invoice_client_oib: invoiceData.invoice_client_oib,
      invoice_business_premise_uuid: invoiceData.invoice_business_premise_uuid,
      invoice_business_premise_name: invoiceData.invoice_business_premise_name,
      invoice_business_premise_address: invoiceData.invoice_business_premise_address,
      invoice_business_premise_postal_code: invoiceData.invoice_business_premise_postal_code || '',
      invoice_business_premise_postal_town: invoiceData.invoice_business_premise_postal_town,
      invoice_business_premise_fiscal_mark: invoiceData.invoice_business_premise_fiscal_mark,
      invoice_billing_device_uuid: invoiceData.invoice_billing_device_uuid,
      invoice_billing_device_fiscal_mark: invoiceData.invoice_billing_device_fiscal_mark,
      invoice_is_pay: true,
      invoice_payment_data_uuid: 'keš',
      invoice_ZKI: "",
      //invoice_method_name: "terminal",
      invoice_operator_name: user.user_name + ' ' + user.user_surname,
      invoice_operator_id: user.id,
      invoice_operator_uuid: user.user_uuid,
      invoice_operator_mark: user.user_mark,
      invoice_payment_method_uuid: payment.uuid,
      invoice_payment_method_name: payment.name,
      invoice_payment_method_fiscal_mark: payment.payment_type_acr || payment.acr,
      order_number: orderUUID,
      buyer_uuid: invoiceData.buyer_uuid || '',
      buyer_name: invoiceData.buyer_name || '',
      buyer_email: invoiceData.buyer_email || '',
      buyer_tel: invoiceData.buyer_tel || '',
      buyer_company_name: invoiceData.buyer_company_name || '',
      buyer_address: invoiceData.buyer_address || '',
      buyer_oib: invoiceData.buyer_oib || '',
      buyer_postal_code: invoiceData.buyer_postal_code || '',
      buyer_town: invoiceData.buyer_town || '',
      buyer_country: invoiceData.buyer_country || '',
      shift_uuid: shiftData.shift_uuid,
      //shift_closed: false,
      invoice_status: 'canceled',
      invoice_canceled: true,
      invoice_amount:+(Number(invoiceData.invoice_amount) * stornoFactor).toFixed(2) * -1,
      invoice_vat_base: +(Number(invoiceData.invoice_vat_base) * stornoFactor).toFixed(2) * -1,
      invoice_vat: +(Number(invoiceData.invoice_vat) * stornoFactor).toFixed(2) * -1,
      invoice_harbor_tax: +(Number(invoiceData.invoice_harbor_tax) * stornoFactor).toFixed(2) * -1,
      invoice_items: itemsToAdd,
      payment_data: paymentData || {},
      invoice_canceled_pair:invoiceData.invoice_uuid
    };
    // 1) Lokalna baza prvi.
    await invoicesModel.update({
      invoice_status:'canceled-orginal',
      invoice_canceled:true,
      invoice_canceled_pair:invoiceToAdd.invoice_uuid
    },{
      where:{
        invoice_uuid:invoiceData.invoice_uuid
      }
    })
    await invoicesModel.create(invoiceToAdd)
    await invoiceTransportItemsModel.bulkCreate(itemsToAdd)
    await ticketsGroupsModel.bulkCreate(ticketsGroupToAdd)
    await ticketsModel.update({
        ticket_is_active: false,
        ticket_is_canceled: true,
        ticket_deactivate:true,
        shift_uuid: shiftData.shift_uuid,
        ticket_status: 'CANCELED'
    },{
      where:{
        order_number:invoiceData.order_number
      }
    });

    // 2) Print s lokalnim autoritativnim brojem. Print fail ne smije prekinuti POST.
    const invoiceDataForPrint = {
      basic_data:basicData,
      invoice: invoiceToAdd,
      tickets_groups: ticketsGroupToAdd,
      items: itemsToAdd,
    }
    try {
      await cancelInvoicePrint(invoiceDataForPrint)
    } catch (printErr) {
      console.log('cancelInvoicePrint failed (printer issue?):', printErr?.message || printErr)
    }

    // 3) Backend POST — best-effort. Ako padne, ostaje pending i sync će gurnuti.
    if (!backendUrl) {
      console.log('cancelInvoiceService: backend_url nije postavljen — ostaje pending za sync.');
      return
    }
    const stornoEnvelope = {
      basic_data: basicData,
      invoice: invoiceToAdd,
      tickets_groups: ticketsGroupToAdd,
      items: itemsToAdd,
      tickets: [],
    }
    try {
      const sendInvoice = await axios.post(backendUrl + "/terminals/terminal/add_invoices", stornoEnvelope, {
        headers: { authorization: "Bearer " + token },
        timeout: 15000,
      });
      if (sendInvoice.status === 200) {
        await invoicesModel.update({ invoice_send: 'SEND' }, { where: { invoice_uuid: invoiceToAdd.invoice_uuid } })
      }
    } catch (e) {
      console.log('storno backend POST failed (offline?), ostaje pending:', e?.message || e);
    }
  } catch (error) {
    console.log(error)
  }
}

const printInvoiceCopyService = async (data)=>{
  try {
    const basicData = await companyModel.findOne()
    const invoiceData = await invoicesModel.findOne({
      where:{
        invoice_uuid:data
      },
      order: [["id", "DESC"]],
      attributes: { exclude: ["createdAt", "updatedAt"] },
    });
    const invoiceItems = await invoiceTransportItemsModel.findAll({
      where:{
        invoice_uuid:data
      },
      order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }
    })
    const ticketsGroups = await ticketsGroupsModel.findAll({
      where:{
        order_number:invoiceData.order_number
      },
      order: [["id", "ASC"]],attributes: { exclude: ["createdAt", "updatedAt"] }
    })
    let itemsToSend = []
    for(const item of invoiceItems){
      const groupsForItem = ticketsGroups.filter((group)=> group.item_uuid === item.item_uuid)
      const newItem = {
        ...item.toJSON(),
        tickets_group: groupsForItem.map(g => g.toJSON?.() ?? g)
      };
      console.log('IS MODEL:', typeof item.toJSON === 'function');
      itemsToSend = [...itemsToSend, newItem]
    }
    const dataToSend = {
      basic_data:basicData,
      invoice: invoiceData,
      tickets_groups: ticketsGroups,
      items: itemsToSend,
      // Bez ovoga printInvoice ne zna da je kopija pa natpis KOPIJA RAČUNA nije
      // izlazio — kopija je izgledala identično originalu. Kopije karata su ovu
      // zastavicu slale od početka, račun ne.
      copy: true,
    }
    // Ishod se vraća pozivatelju — F2 račun se ne ispisuje, pa blagajnik mora
    // dobiti poruku umjesto tihog "ništa se nije dogodilo".
    return await copyInvoicePrint(dataToSend)

  } catch (error) {
    console.log(error)
    return { printed: false, reason: 'error' }
  }
}

const printAllTicketsCopyService = async(data)=>{
  try {
    const invoiceData = await invoicesModel.findOne({
      where:{
        invoice_uuid:data
      },
      order: [["id", "DESC"]],
      attributes: { exclude: ["createdAt", "updatedAt"] },
    });
    const ticketsData = await ticketsModel.findAll({
      where:{
        order_number:invoiceData.order_number
      }
    })
    // Stornirane karte se preskaču, ostale s računa se ispišu. Kod djelomičnog
    // storna račun i dalje ima valjane karte pa ispis ne treba odbiti u cijelosti.
    const zaIspis = ticketsData.filter((t) => !(t.ticket_status === 'CANCELED' || t.ticket_is_canceled || t.ticket_deactivate))
    if (!zaIspis.length) {
      console.log('KOPIJE KARATA — sve karte računa su stornirane, ispis preskočen.')
      return { printed: false, reason: 'storno' }
    }
    const dataToSend = {
      tickets:zaIspis,
      copy:true
    }
    await copyAllTickets(dataToSend)
    return { printed: true, skipped: ticketsData.length - zaIspis.length }
  } catch (error) {
    console.log(error)
    return { printed: false, reason: 'error' }
  }
}

const printTicketCopyService = async(data)=>{
  try {
    const ticketData = await ticketsModel.findAll({
      where:{
        ticket_code:data
      }
    })
    // Stornirana karta se ne ispisuje — ne vrijedi za ukrcaj, a otisnuta
    // izgleda kao valjana.
    const zaIspis = ticketData.filter((t) => !(t.ticket_status === 'CANCELED' || t.ticket_is_canceled || t.ticket_deactivate))
    if (!zaIspis.length) {
      console.log('KOPIJA KARTE — karta je stornirana, ispis preskočen.')
      return { printed: false, reason: 'storno' }
    }
    const dataToSend = {
      tickets:zaIspis,
      copy:true
    }
    await copyAllTickets(dataToSend)
    return { printed: true }
  } catch (error) {
    console.log(error)
  }
}

const TIC_DATE_KEYS = ["ticket_departure_planed","ticket_departure", "ticket_arrival_planed", "ticket_arrival"];

const getTicketsDataService = async()=>{
  try {
    const ticketsData = await ticketsModel.findAll({
      order: [["id", "DESC"]],attributes: { exclude: ["createdAt", "updatedAt"] }
    })
    return {
      tickets: ticketsData.map((b) => b.toJSON()),
    }
  } catch (error) {
    console.log(error)
  }
}

const cancelTicketService = async ({ticket, user, payment, paymentData, stornoPct })=>{
  try {
    const basicData = await companyModel.findOne()
    const pairingDAta = await pairingDataModel.findOne();
    const settingsData = await systemSettingsDataModel.findOne();
    const token = pairingDAta.token;
    const backendUrl = settingsData?.backend_url;
    if (!backendUrl) console.log('cancelTicketService: backend_url nije postavljen u Settings.');
    const invoiceData = await invoicesModel.findOne({
      where:{
        order_number:ticket.order_number
      }
    })
    // Zadnja brana protiv dvostrukog storna karte — stanje se čita iz baze, ne
    // iz onoga što je poslalo sučelje, jer se lista karata zna zadržati u
    // memoriji nakon što je karta već stornirana.
    const ticketState = await ticketsModel.findOne({ where: { ticket_uuid: ticket.ticket_uuid } })
    if (!ticketState) {
      return { ok: false, error: { message: 'Karta nije pronađena.' } }
    }
    if (ticketState.ticket_status === 'CANCELED' || ticketState.ticket_is_canceled || ticketState.ticket_deactivate) {
      console.log('cancelTicketService: karta je već stornirana —', ticketState.ticket_code)
      return { ok: false, error: { message: 'Karta je već stornirana i ne može se stornirati ponovno.' } }
    }

    const ticketsGroup = await ticketsGroupsModel.findAll({
      where:{
        ticket_group_uuid:ticket.ticket_group_uuid
      }
    })

    const invoiceUUID = crypto.randomBytes(16).toString("hex")
    const orderUUID = crypto.randomBytes(16).toString("hex")
    const itemUUID = crypto.randomBytes(16).toString("hex")
    // Invoice MORA pripasti OTVORENOJ smjeni tog usera. Bez shift_open: true
    // bismo riskirali da račun završi u zatvorenoj prošloj smjeni (npr. ako user
    // nije otvorio novu) — to kvari obračun rada svakog operatera.
    const shiftData = await shiftModel.findOne({
      where: {
        operater_username: user.user_username,
        shift_open: true,
      },
      order: [['id', 'DESC']],
    })
    if (!shiftData) {
      throw new Error(`Operater ${user.user_username} nema otvorenu smjenu — račun se ne može izdati.`)
    }
    // Lokalna numeracija (autoritet je boat-desk; mora raditi offline).
    // Storno prati tip izvornog računa — vidi cancelInvoiceService.
    const isF2 = invoiceIsF2(invoiceData);
    const invoiceYear = new Date().getFullYear();
    const billingDeviceUuid = basicData.billing_device_uuid;
    const invoiceNo = await nextInvoiceNoLocal(invoiceYear, billingDeviceUuid, settingsData);
    const invoiceFiskalNo = isF2 ? null : await nextInvoiceFiskalNoLocal(invoiceYear, billingDeviceUuid, settingsData);
    const invoiceCode = buildInvoiceCode(isF2, invoiceFiskalNo, basicData.business_premise_fiscal_mark, basicData.billing_device_fiscal_mark);

    let itemsToAdd = []
    let ticketsGroupToAdd = []

    // Postotak povrata bira blagajnik iz šifarnika (isto kao na mobilnoj). Ako
    // ga nema — stariji poziv ili prazan šifarnik — vraća se puni iznos, kako je
    // radilo i prije. Zaokružuje se na cent prije razrade PDV-a i lučke
    // pristojbe, da zbroj stavki odgovara iznosu računa.
    const stornoFactor = Number.isFinite(Number(stornoPct)) && Number(stornoPct) > 0
        ? Math.min(100, Number(stornoPct)) / 100
        : 1;
    const refundPrice = +(Number(ticket.ticket_single_price) * stornoFactor).toFixed(2);

    const newGroup = {
        ticket_group_uuid: ticketsGroup.ticket_group_uuid,
        ticket_type_name: ticket.ticket_type_name,
        ticket_type_id: ticket.ticket_type_id,
        ticket_type_uuid: ticket.ticket_type_uuid,
        sales_route_uuid: ticket.sales_route_uuid,
        single_price: refundPrice,
        total_price: refundPrice,
        total_vat_base: ((refundPrice * 0.94)/1.25).toFixed(2) ,
        total_vat: (refundPrice*0.94).toFixed(2)- ((refundPrice * 0.94)/1.25).toFixed(2),
        total_harbor_tax: (refundPrice).toFixed(2)- (refundPrice*0.94).toFixed(2),
        shift_uuid: shiftData.shift_uuid,
        order_number: orderUUID,
        item_uuid: itemUUID,
        quantity: -1,
    }
    ticketsGroupToAdd = [...ticketsGroupToAdd, newGroup]

    const newItem = {
        item_uuid: itemUUID,
        invoice_uuid: invoiceUUID,
        sales_route_uuid: ticket.sales_route_uuid,
        line_code: ticket.line_code,
        line_name: ticket.line_name,
        departure: ticket.ticket_departure,
        departure_harbor_id: ticket.ticket_departure_harbor_id,
        departure_harbor_name: ticket.ticket_departure_harbor_name,
        arrival: ticket.ticket_arrival,
        arrival_harbor_id: ticket.ticket_arrival_harbor_id,
        arrival_harbor_name: ticket.ticket_arrival_harbor_name,
        item_amount:refundPrice,
        item_vat_base:((refundPrice * 0.94)/1.25).toFixed(2) ,
        item_vat:(refundPrice*0.94).toFixed(2)- ((refundPrice * 0.94)/1.25).toFixed(2),
        item_harbor_fee:(refundPrice).toFixed(2)- (refundPrice*0.94).toFixed(2),
        shift_uuid: shiftData.shift_uuid,
        order_number: orderUUID,
        tickets_group: ticketsGroupToAdd,
      }
      itemsToAdd = [...itemsToAdd, newItem]

      // Storno karte nasljeđuje OIB iz originala — bez podataka o kupcu storno
      // ne bi bio uparen s računom koji ispravlja.
      const invoiceToAdd = {
        invoice_uuid: invoiceUUID,
        invoice_no: invoiceNo,
        invoice_fiskal_no: invoiceFiskalNo,
        invoice_code: invoiceCode,
        fiskal_required: isF2,
        is_f2: isF2,
        invoice_year: invoiceYear,
        invoice_date: new Date(),
        invoice_client_uuid: basicData.clinet_uuid,
        invoice_client_name: basicData.client_name,
        invoice_client_address: basicData.client_address,
        invoice_client_postal_code: basicData.client_postal_code,
        invoice_client_town: basicData.client_town,
        invoice_client_country: basicData.client_country,
        invoice_client_oib: basicData.client_legal_id,
        invoice_business_premise_uuid: basicData.business_premise_uuid,
        invoice_business_premise_name: basicData.business_premise_name,
        invoice_business_premise_address: basicData.business_premise_address,
        invoice_business_premise_postal_code: basicData.business_premise_postal_code || '',
        invoice_business_premise_postal_town: basicData.business_premise_town,
        invoice_business_premise_fiscal_mark: basicData.business_premise_fiscal_mark,
        invoice_billing_device_uuid: basicData.billing_device_uuid,
        invoice_billing_device_fiscal_mark: basicData.billing_device_fiscal_mark,
        invoice_is_pay: true,
        invoice_payment_data_uuid: 'keš',
        invoice_ZKI: "",
        //invoice_method_name: "terminal",
        invoice_operator_name: user.user_name + ' ' + user.user_surname,
        invoice_operator_id: user.id,
        invoice_operator_uuid: user.user_uuid,
        invoice_operator_mark: user.user_mark,
        invoice_payment_method_uuid: payment.uuid,
        invoice_payment_method_name: payment.name,
        invoice_payment_method_fiscal_mark: payment.payment_type_acr,
        order_number: orderUUID,
        buyer_uuid: invoiceData.buyer_uuid || '',
        buyer_name: invoiceData.buyer_name || '',
        buyer_email: invoiceData.buyer_email || '',
        buyer_tel: invoiceData.buyer_tel || '',
        buyer_company_name: invoiceData.buyer_company_name || '',
        buyer_address: invoiceData.buyer_address || '',
        buyer_oib: invoiceData.buyer_oib || '',
        buyer_postal_code: invoiceData.buyer_postal_code || '',
        buyer_town: invoiceData.buyer_town || '',
        buyer_country: invoiceData.buyer_country || '',
        shift_uuid: shiftData.shift_uuid,
        //shift_closed: false,
        invoice_status: 'canceled',
        invoice_canceled: true,
        invoice_amount: refundPrice * -1,
        invoice_vat_base: ((refundPrice * 0.94)/1.25).toFixed(2) * -1,
        invoice_vat: (refundPrice*0.94).toFixed(2)- ((refundPrice * 0.94)/1.25).toFixed(2) * -1,
        invoice_harbor_tax: (refundPrice).toFixed(2)- (refundPrice*0.94).toFixed(2) * -1,
        invoice_items: itemsToAdd,
        payment_data: paymentData || {},
        invoice_canceled_pair:invoiceData.invoice_uuid
      };

      // 1) Lokalna baza prvi.
      await invoicesModel.update({
          invoice_status:'canceled-partial',
          invoice_canceled:true,
          invoice_canceled_pair:invoiceToAdd.invoice_uuid
        },{
          where:{
            invoice_uuid:invoiceData.invoice_uuid
          }
        })
      await invoicesModel.create(invoiceToAdd)
      await invoiceTransportItemsModel.bulkCreate(itemsToAdd)
      await ticketsGroupsModel.bulkCreate(ticketsGroupToAdd)
      await ticketsModel.update({
          ticket_is_active: false,
          ticket_is_canceled: true,
          ticket_deactivate:true,
          shift_uuid: shiftData.shift_uuid,
          ticket_status: 'CANCELED'
      },{
        where:{
          ticket_uuid:ticket.ticket_uuid
        }
      });

      // 2) Print s lokalnim autoritativnim brojem. Print fail ne smije prekinuti POST.
      const invoiceDataForPrint = {
        basic_data:basicData,
        invoice: invoiceToAdd,
        tickets_groups: ticketsGroupToAdd,
        items: itemsToAdd,
      }
      try {
        await cancelInvoicePrint(invoiceDataForPrint)
      } catch (printErr) {
        console.log('cancelInvoicePrint (ticket) failed (printer issue?):', printErr?.message || printErr)
      }

      // 3) Backend POST — best-effort. Ako padne, ostaje pending i sync će gurnuti.
      if (!backendUrl) {
        console.log('cancelTicketService: backend_url nije postavljen — ostaje pending za sync.');
        return
      }
      const stornoEnvelope = {
        basic_data: basicData,
        invoice: invoiceToAdd,
        tickets_groups: ticketsGroupToAdd,
        items: itemsToAdd,
        tickets: [],
      }
      try {
        const sendInvoice = await axios.post(backendUrl + "/terminals/terminal/add_invoices", stornoEnvelope, {
          headers: { authorization: "Bearer " + token },
          timeout: 15000,
        });
        if (sendInvoice.status === 200) {
          await invoicesModel.update({ invoice_send: 'SEND' }, { where: { invoice_uuid: invoiceToAdd.invoice_uuid } })
        }
      } catch (e) {
        console.log('cancelTicket backend POST failed (offline?), ostaje pending:', e?.message || e);
      }

  } catch (error) {
    console.log(error)
  }
}

// Povuče autoritativni F2 (YesCor) status iz backenda za jedan račun i upiše
// yescor_* polja u lokalni invoice. Koristi se za F2 status kolonu u listi
// računa — backend YesCor poller je autoritet, desk samo prikazuje.
const refreshInvoiceF2StatusService = async (invoiceUuid) => {
  try {
    if (!invoiceUuid) return { ok: false, reason: 'no_uuid' }
    const settingsData = await systemSettingsDataModel.findOne()
    const pairingData = await pairingDataModel.findOne()
    const backendUrl = settingsData?.backend_url
    if (!backendUrl) return { ok: false, reason: 'no_backend_url' }
    const response = await axios.get(backendUrl + '/terminals/terminal/invoice/' + invoiceUuid, {
      headers: { authorization: 'Bearer ' + pairingData.token },
      timeout: 15000,
      validateStatus: () => true,
    })
    if (response.status !== 200) return { ok: false, reason: 'http_' + response.status }
    const remoteInvoice = response.data?.data?.invoice
    if (!remoteInvoice) return { ok: false, reason: 'no_invoice' }
    await invoicesModel.update({
      yescor_document_id: remoteInvoice.yescor_document_id ?? null,
      yescor_status: remoteInvoice.yescor_status ?? null,
      yescor_fiscalization_status: remoteInvoice.yescor_fiscalization_status ?? null,
      yescor_error_message: remoteInvoice.yescor_error_message ?? null,
      yescor_last_sync_at: remoteInvoice.yescor_last_sync_at ?? null,
      fiskal_required: remoteInvoice.fiskal_required ?? null,
      invoice_fiskal_no: remoteInvoice.invoice_fiskal_no ?? null,
    }, { where: { invoice_uuid: invoiceUuid } })
    return { ok: true }
  } catch (error) {
    console.log('refreshInvoiceF2StatusService error:', error?.message || error)
    return { ok: false, reason: error?.message || 'error' }
  }
}

// Bulk refresh F2 statusa za sve lokalne F2 račune čija fiskalizacija nije
// uspješno završena. R1 računi bez F2 oznake se ovdje ne pojavljuju jer uopće
// ne idu u YesCor. Pozovi prilikom otvaranja liste računa.
const refreshPendingF2InvoicesService = async () => {
  try {
    const pending = await invoicesModel.findAll({
      where: { fiskal_required: true },
      attributes: ['invoice_uuid', 'yescor_fiscalization_status'],
    })
    const toRefresh = pending.filter(p => p.yescor_fiscalization_status !== 'successful')
    let updated = 0
    for (const row of toRefresh) {
      const result = await refreshInvoiceF2StatusService(row.invoice_uuid)
      if (result.ok) updated++
    }
    return { ok: true, checked: toRefresh.length, updated }
  } catch (error) {
    console.log('refreshPendingF2InvoicesService error:', error?.message || error)
    return { ok: false, reason: error?.message || 'error' }
  }
}

// Sync pending računa: pošalje backendu sve lokalne fakture kojima invoice_send !== 'SEND'.
// Backend (addTerminalSaleController) je idempotentan po invoice_uuid pa je retry siguran.
// Pozovi pri startu app-a i nakon svake nove prodaje (best-effort, ne ruši UI).
const syncPendingInvoicesService = async () => {
  try {
    const settingsData = await systemSettingsDataModel.findOne()
    const pairingData = await pairingDataModel.findOne()
    const basicData = await companyModel.findOne()
    const backendUrl = settingsData?.backend_url
    const token = pairingData?.token
    if (!backendUrl || !token) return { ok: false, reason: 'no_backend_url_or_token' }

    const { Op } = require('sequelize')
    const pending = await invoicesModel.findAll({
      where: {
        [Op.or]: [
          { invoice_send: null },
          { invoice_send: { [Op.ne]: 'SEND' } },
        ],
      },
      order: [['id', 'ASC']],
    })
    let pushed = 0
    let failed = 0
    for (const row of pending) {
      const invoiceUuid = row.invoice_uuid
      try {
        const items = await invoiceTransportItemsModel.findAll({ where: { invoice_uuid: invoiceUuid } })
        const groups = await ticketsGroupsModel.findAll({ where: { order_number: row.order_number } })
        const tickets = await ticketsModel.findAll({ where: { order_number: row.order_number } })
        const itemsWithGroups = items.map((it) => {
          const itemJson = it.toJSON()
          itemJson.tickets_group = groups.filter(g => g.item_uuid === itemJson.item_uuid).map(g => g.toJSON())
          return itemJson
        })
        const envelope = {
          basic_data: basicData,
          invoice: row.toJSON(),
          tickets_groups: groups.map(g => g.toJSON()),
          items: itemsWithGroups,
          tickets: tickets.map(t => t.toJSON()),
        }
        const resp = await axios.post(backendUrl + '/terminals/terminal/add_invoices', envelope, {
          headers: { authorization: 'Bearer ' + token },
          timeout: 15000,
        })
        if (resp.status === 200) {
          await invoicesModel.update({ invoice_send: 'SEND' }, { where: { invoice_uuid: invoiceUuid } })
          pushed++
        } else {
          failed++
        }
      } catch (e) {
        failed++
        console.log('syncPendingInvoicesService: invoice', invoiceUuid, 'still pending:', e?.message || e)
      }
    }
    return { ok: true, total: pending.length, pushed, failed }
  } catch (error) {
    console.log('syncPendingInvoicesService error:', error?.message || error)
    return { ok: false, reason: error?.message || 'error' }
  }
}

module.exports = {
  getInvoicesDataService,
  getInvoiceDataService,
  getInvoicesDetailsDataService,
  createInvoiceService,
  cancelInvoiceService,
  printInvoiceCopyService,
  printAllTicketsCopyService,
  printTicketCopyService,
  getTicketsDataService,
  cancelTicketService,
  refreshInvoiceF2StatusService,
  refreshPendingF2InvoicesService,
  getNextInvoiceNumbersService,
  syncPendingInvoicesService
}