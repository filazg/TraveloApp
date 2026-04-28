const crypto = require("crypto");
const { getSequelize } = require("../../config/database");
const ticketsModels = require("../../dbModels/tickets.models");
const { sendInvoiceToYescor } = require("../integrations/sendInvoiceToYescor");
const { reserveBookings, releaseBookings } = require("../../helpers/bookingClient");
const sequelize = getSequelize();

// Boat-desk (i Sunmi mobile) su autoriteti za fiskalnu numeraciju jer moraju raditi
// offline. Računaju invoice_no/invoice_fiskal_no/invoice_code lokalno per (godina ×
// billing_device) i šalju ih ovamo. Backend ovdje samo PASIVNO sprema dolazni payload
// (idempotentno po invoice_uuid) i pokreće YesCor F2 kad ima buyer_oib.
const addTerminalSaleController = async(req,res)=>{
    try {
        const { InvoiceModel, InvoiceItemsModel, InvoiceItemDetailsModel, TicketsModel} = req.app.locals.models;
        const data = req.body?.body || req.body || {}
        let createdNewInvoice = false;
        await sequelize.transaction(async (t)=>{
            const invoiceExist = await InvoiceModel.findOne({
                where:{
                    invoice_uuid:data.invoice.invoice_uuid
                }
            })
            if(invoiceExist){
                // Idempotentno — boat-desk može pokušati retry za isti invoice_uuid.
            }else{
                const isR1 = !!data.invoice.buyer_oib;
                const invoiceToAdd = {
                    company_name:data.invoice.invoice_client_name,
                    company_address:data.invoice.invoice_client_address,
                    company_postal_code:data.invoice.invoice_client_postal_code,
                    company_town:data.invoice.invoice_client_town,
                    company_id:data.basic_data.client_legal_id,
                    company_vatid:data.basic_data.client_vat_id,
                    operater_uuid:data.invoice.invoice_operator_uuid,
                    operater_name:data.invoice.invoice_operator_name,
                    operator_id:data.invoice.invoice_operator_id,
                    operator_mark:data.invoice.invoice_operator_mark,
                    invoice_uuid:data.invoice.invoice_uuid,
                    invoice_no: data.invoice.invoice_no,
                    invoice_fiskal_no: data.invoice.invoice_fiskal_no ?? null,
                    invoice_code: data.invoice.invoice_code ?? null,
                    invoice_year:data.invoice.invoice_year,
                    invoice_date:data.invoice.invoice_date,
                    invoice_business_premise_uuid:data.invoice.invoice_business_premise_uuid,
                    invoice_business_premise_name:data.invoice.invoice_business_premise_name,
                    invoice_business_premise_fiscal_mark:data.invoice.invoice_business_premise_fiscal_mark,
                    invoice_billing_device_uuid:data.invoice.invoice_billing_device_uuid,
                    invoice_billing_device_fiscal_mark:data.invoice.invoice_billing_device_fiscal_mark,
                    invoice_is_pay:data.invoice.invoice_is_pay,
                    invoice_payment_data:data.invoice.payment_data,
                    invoice_ZKI:data.invoice.invoice_ZKI,
                    invoice_JIR:data.invoice.invoice_JIR || '',
                    invoice_operator_name:data.invoice.invoice_operator_name,
                    invoice_payment_method_uuid:data.invoice.invoice_payment_method_uuid,
                    invoice_payment_method_name:data.invoice.invoice_payment_method_name,
                    invoice_payment_method_fiscal_mark:data.invoice.invoice_payment_method_fiscal_mark,
                    buyer_uuid:data.invoice.buyer_uuid,
                    buyer_name:data.invoice.buyer_name,
                    buyer_email:data.invoice.buyer_email,
                    buyer_tel:data.invoice.buyer_tel,
                    buyer_company_name:data.invoice.buyer_company_name,
                    buyer_address:data.invoice.buyer_address,
                    buyer_oib:data.invoice.buyer_oib,
                    buyer_postal_code:data.invoice.buyer_postal_code,
                    buyer_town:data.invoice.buyer_town,
                    buyer_country:data.invoice.buyer_country,
                    shift_uuid:data.invoice.shift_uuid,
                    invoice_status:data.invoice.invoice_status,
                    invoice_canceled:data.invoice.invoice_canceled,
                    invoice_canceled_pair:data.invoice.invoice_canceled_pair,
                    invoice_amount:data.invoice.invoice_amount,
                    invoice_vat_base:data.invoice.invoice_vat_base,
                    invoice_vat:data.invoice.invoice_vat,
                    invoice_harbor_tax:data.invoice.invoice_harbor_tax,
                    order_uuid:data.invoice.order_uuid || '',
                    language:data.invoice.language || 'cro',
                    fiskal_required: isR1,
                }
                let itemsToAdd = []
                let itemDetailsToAdd = []
                let ticketsToAdd = []
                for(const item of data.items){
                    item.route_uuid = item.sales_route_uuid
                    itemsToAdd = [...itemsToAdd, item]
                    for(const detail of item.tickets_group){
                        console.log('DETAILS', detail)
                        detail.item_details_uuid = crypto.randomUUID()
                        detail.item_amount = detail.total_price
                        detail.item_vat_base = detail.total_vat_base
                        detail.item_vat = detail.total_vat
                        detail.item_harbor_fee = detail.total_harbor_tax
                        itemDetailsToAdd = [...itemDetailsToAdd,detail]
                    }
                }
                for(const ticket of data.tickets){
                    ticket.order_uuid = ticket.order_number,
                    ticket.single_price = ticket.ticket_single_price,
                    ticket.is_active = ticket.ticket_is_active,
                    ticket.is_canceled = ticket.ticket_is_canceled,
                    ticket.route_uuid = ticket.sales_route_uuid,
                    ticket.departure_planed = ticket.ticket_departure_planed,
                    ticket.departure = ticket.ticket_departure,
                    ticket.departure_harbor_id = ticket.ticket_departure_harbor_id,
                    ticket.departure_harbor_name = ticket.ticket_departure_harbor_name,
                    ticket.arrival_planed = ticket.ticket_arrival_planed,
                    ticket.arrival = ticket.ticket_arrival,
                    ticket.arrival_harbor_id = ticket.ticket_arrival_harbor_id,
                    ticket.arrival_harbor_name = ticket.ticket_arrival_harbor_name,
                    ticket.deactivate = ticket.ticket_deactivate,
                    ticket.status = ticket.ticket_status
                    ticketsToAdd = [...ticketsToAdd, ticket]
                 }
                console.log(itemsToAdd)
                await InvoiceModel.create(invoiceToAdd, { transaction: t })
                await InvoiceItemsModel.bulkCreate(itemsToAdd, { transaction: t })
                await InvoiceItemDetailsModel.bulkCreate(itemDetailsToAdd, { transaction: t })
                await TicketsModel.bulkCreate(ticketsToAdd, { transaction: t })
                createdNewInvoice = true;
            }
        })

        // Booking-service rezervacija/oslobađanje kapaciteta. Boat-desk je
        // autoritativno već lokalno ispisao karte, pa ovdje samo sinkroniziramo
        // booking-service stanje. Best-effort — log i nastavi (boat-desk neka
        // ipak završi response da klijent ažurira svoj UI).
        if (createdNewInvoice) {
            const reserveItems = []
            for (const item of (data.items || [])) {
                for (const group of (item.tickets_group || [])) {
                    const route_uuid = group.sales_route_uuid || group.route_uuid || item.sales_route_uuid || item.route_uuid;
                    const ticket_type_uuid = group.ticket_type_uuid;
                    const qty = Math.abs(parseInt(group.quantity, 10) || 0);
                    if (route_uuid && ticket_type_uuid && qty) {
                        reserveItems.push({ route_uuid, ticket_type_uuid, qty });
                    }
                }
            }
            if (reserveItems.length) {
                try {
                    if (data.invoice.invoice_canceled) {
                        await releaseBookings(reserveItems);
                    } else {
                        await reserveBookings(reserveItems);
                    }
                } catch (bookingErr) {
                    console.log('booking reserve/release failed (boat-desk add_invoices):', bookingErr?.message || bookingErr);
                }
            }
        }

        // F2 fiskalizacija (YesCor) — okida se samo za R1 račune (kupac s OIB-om).
        // Fire-and-forget van transakcije: invoice je već spremljen, ako YesCor
        // padne yescor_status ostaje failed i poller će kasnije retry-ati.
        if (createdNewInvoice && data.invoice.buyer_oib) {
            (async () => {
                try {
                    const company = {
                        name: data.basic_data?.client_name || data.invoice.invoice_client_name,
                        address: data.basic_data?.client_address || data.invoice.invoice_client_address,
                        postal_code: data.basic_data?.client_postal_code || data.invoice.invoice_client_postal_code,
                        town: data.basic_data?.client_town || data.invoice.invoice_client_town,
                        legal_id: data.basic_data?.client_legal_id || data.invoice.invoice_client_oib,
                        vat_id: data.basic_data?.client_vat_id,
                        email: data.basic_data?.client_email || '',
                    };
                    const result = await sendInvoiceToYescor({
                        invoice: data.invoice,
                        items: data.invoice.invoice_items || data.items || [],
                        company,
                        operator: {
                            mark: data.invoice.invoice_operator_mark,
                            oib: company.legal_id,
                        },
                        buyer: {
                            buyer_name: data.invoice.buyer_name,
                            buyer_company_name: data.invoice.buyer_company_name,
                            buyer_oib: data.invoice.buyer_oib,
                            buyer_address: data.invoice.buyer_address,
                            buyer_postal_code: data.invoice.buyer_postal_code,
                            buyer_town: data.invoice.buyer_town,
                            buyer_country: data.invoice.buyer_country,
                            buyer_email: data.invoice.buyer_email,
                        },
                        paymentMeans: data.invoice.invoice_payment_method_fiscal_mark === 'K' ? '48'
                            : data.invoice.invoice_payment_method_fiscal_mark === 'T' ? '30' : '10',
                    });
                    const respData = result.response?.data;
                    const yescorDocId = typeof respData === 'string' ? respData : respData?.data;
                    const ok = result.response?.status >= 200 && result.response?.status < 300;
                    await InvoiceModel.update({
                        yescor_document_id: yescorDocId || null,
                        yescor_status: ok ? 'submitted' : 'failed',
                        yescor_error_message: ok ? null : (respData?.error?.message || JSON.stringify(respData?.error || respData) || null),
                        yescor_last_sync_at: new Date(),
                        yescor_raw_response: respData || null,
                    }, { where: { invoice_uuid: data.invoice.invoice_uuid } });
                    console.log(`[yescor] invoice ${data.invoice.invoice_uuid} → ${ok ? 'submitted' : 'failed'} (HTTP ${result.response?.status}, doc=${yescorDocId || '—'})`);
                } catch (yescorErr) {
                    console.log('[yescor] submit failed:', yescorErr?.message || yescorErr);
                    try {
                        await InvoiceModel.update({
                            yescor_status: 'failed',
                            yescor_error_message: String(yescorErr?.message || yescorErr).slice(0, 500),
                            yescor_last_sync_at: new Date(),
                        }, { where: { invoice_uuid: data.invoice.invoice_uuid } });
                    } catch (_) {}
                }
            })();
        }

        // Vrati invoice_uuid + autoritativna fiskalna polja klijent može ažurirati
        // lokalnu kopiju (boat-desk sprema invoice prije response-a).
        const saved = await InvoiceModel.findOne({
            where: { invoice_uuid: data.invoice.invoice_uuid },
            attributes: ['invoice_uuid', 'invoice_no', 'invoice_fiskal_no', 'invoice_code', 'fiskal_required'],
        });
        res.send({
            status:200,
            data: saved ? saved.toJSON() : null,
        })
    } catch (error) {
        console.log(error)
        res.send({
            status:500,
            data:{
                error
            }
        })
    }
}

module.exports = {
    addTerminalSaleController
}