const axios = require('axios');
const { getCoreServiceConfigData } = require('../configSyncController');
const { isSaleOpen, saleClosedMessage, isSailingCanceled, sailingCanceledMessage } = require('../../helpers/departureCutoff');
const { initMonriPayment } = require('../../helpers/monriPayment');
const { desktopOnlyTicketTypes } = require('../../helpers/webTicketTypes');

// Povratna adresa nakon Monrija za novu web prodaju (v2). Monri traži https,
// pa se lokalni razvoj (http) vraća na testni poslužitelj — ista baza, pa se
// narudžba ondje jednako dovrši.
const WEB_SALE_PUBLIC_PATH = process.env.WEB_SALE_PUBLIC_PATH || '/web_sale';
const V2_FALLBACK_SUCCESS_URL = process.env.WEB_V2_FALLBACK_SUCCESS_URL
    || 'https://webbookingtest.krilo.hr/web_sale/monricallback/v2';
const v2SuccessUrl = (req) => {
    if (req.protocol !== 'https') return V2_FALLBACK_SUCCESS_URL;
    return `https://${req.get('host')}${WEB_SALE_PUBLIC_PATH}/monricallback/v2`;
};

const createOrderConfirmationController = async (req, res) => {
    try {
        const body = req.body || {};
        const routes = Array.isArray(body.data) ? body.data : [];
        const order_number = body.order_number;
        const buyer = body.buyer_data || {};
        const language = body.language || 'hr';

        console.log('order_confirmation received:', {
            order_number,
            routes_count: routes.length,
            sample_route: routes[0] && {
                sales_route_uuid: routes[0].sales_route_uuid,
                ticket_types: routes[0].ticketsData?.length,
            },
        });

        if (!order_number || !routes.length) {
            return res.status(400).json({
                status: 400,
                data: { message: 'order_number and data (routes) required' },
            });
        }

        // Pretraga već izbacuje polaske kojima je prodaja zatvorena, ali kupac
        // može sjediti na sažetku dok cutoff prođe. Bez ove provjere bi platio
        // kartu za brod koji je otišao, pa se narudžba odbija prije Monrija.
        const { RoutesModel } = req.app.locals.models;
        for (const route of routes) {
            if (!route?.sales_route_uuid) continue;
            const routeData = await RoutesModel.findOne({
                where: { uuid: route.sales_route_uuid },
            });
            if (!routeData) continue;
            // Otkazan polazak se ne prodaje. Pretraga ga vise ne nudi, ali kupac
            // moze sjediti na sazetku dok dispecer otkazuje plovidbu — bez ovoga
            // bi karta bila naplacena za brod koji ne ide.
            if (isSailingCanceled(routeData)) {
                console.log('order_confirmation odbijen — polazak otkazan:', routeData.actual_departure);
                return res.status(409).json({
                    status: 409,
                    data: {
                        message: sailingCanceledMessage(routeData.actual_departure, language),
                        sales_route_uuid: route.sales_route_uuid,
                        actual_departure: routeData.actual_departure,
                        canceled: true,
                    },
                });
            }
            if (!isSaleOpen(routeData.actual_departure)) {
                console.log('order_confirmation odbijen — prodaja zatvorena za', routeData.actual_departure);
                return res.status(409).json({
                    status: 409,
                    data: {
                        message: saleClosedMessage(routeData.actual_departure, language),
                        sales_route_uuid: route.sales_route_uuid,
                        actual_departure: routeData.actual_departure,
                    },
                });
            }
        }

        // Pretraga ih ne nudi, ali narudžba stiže iz preglednika pa se provjerava i ovdje.
        const samoDesk = await desktopOnlyTicketTypes();
        const nedopustena = routes.flatMap((r) => r.ticketsData || []).find((tt) => samoDesk.has(tt.ticket_type_uuid) && tt.quantity > 0);
        if (nedopustena) {
            return res.status(409).json({
                status: 409,
                data: { message: language === 'hr'
                    ? `Karta „${nedopustena.ticket_type_name || ''}" ne prodaje se na webu.`
                    : `Ticket "${nedopustena.ticket_type_name || ''}" is not sold online.` },
            });
        }

        const coreConfig = await getCoreServiceConfigData();
        const salesUrl = coreConfig?.services?.sales?.url;
        if (!salesUrl) {
            return res.status(500).json({
                status: 500,
                data: { message: 'sales service URL not configured' },
            });
        }

        const createdOrders = [];
        const allTickets = [];

        for (const route of routes) {
            const items = (route.ticketsData || [])
                .map(tt => ({
                    ticket_type_uuid: tt.ticket_type_uuid,
                    qty: tt.quantity,
                    // Otočna karta — SEOP podaci se propagiraju do tickets retka.
                    is_island: tt.is_island === true,
                    seop_card_no: tt.seop_card_no || null,
                    seop_pravo: tt.seop_pravo || null,
                    seop_otok: tt.seop_otok || null,
                    seop_discount_pct: tt.seop_discount_pct ?? null,
                }))
                .filter(i => i.qty > 0);
            if (!items.length) continue;

            const resp = await axios.post(
                `${salesUrl}/orders`,
                {
                    route_uuid: route.sales_route_uuid,
                    items,
                    channel: 'web',
                    payment_reference: order_number,
                    language,
                    customer_name: buyer.summary_buyer_name || null,
                    customer_email: buyer.summary_buyer_email || null,
                    customer_phone: buyer.summary_buyer_phone || null,
                    buyer_data: buyer,
                },
                { timeout: 10000, validateStatus: () => true }
            );
            if (resp.status === 200 && resp.data?.data?.order) {
                createdOrders.push(resp.data.data.order);
                if (Array.isArray(resp.data.data.order.tickets)) {
                    allTickets.push(...resp.data.data.order.tickets);
                }
            } else {
                console.log('sales /orders failed for route', route.sales_route_uuid, 'status:', resp.status, 'body:', JSON.stringify(resp.data).slice(0, 400));
            }
        }

        if (createdOrders.length === 0) {
            return res.status(502).json({
                status: 502,
                data: { message: 'order creation failed for all routes — payment not initiated' },
            });
        }

        const totalAmount = createdOrders.reduce(
            (s, o) => s + Number(o.total_amount || 0),
            0
        );

        // Nova web prodaja (v2) ne zna merchant key — plaćanje pokreće server,
        // s iznosom narudžbi koje je upravo izradio sales servis. Stara web
        // prodaja ne šalje init_payment i radi kao prije.
        let payment_url = null;
        if (body.init_payment === true) {
            const amount_cents = Math.round(totalAmount * 100);
            if (amount_cents <= 0) {
                return res.status(409).json({
                    status: 409,
                    data: { message: language === 'hr' ? 'Iznos narudžbe je 0 — nema što platiti.' : 'Order amount is 0 — nothing to pay.' },
                });
            }
            try {
                payment_url = await initMonriPayment({
                    order_number,
                    amount_cents,
                    language,
                    success_url: v2SuccessUrl(req),
                });
            } catch (err) {
                console.log('order_confirmation Monri init failed:', err?.message || err);
                return res.status(502).json({
                    status: 502,
                    data: { message: language === 'hr' ? 'Plaćanje trenutno nije dostupno. Pokušajte ponovno.' : 'Payment is currently unavailable. Please try again.' },
                });
            }
        }

        return res.status(200).json({
            status: 200,
            path: 'orderConfirmation',
            data: {
                payment_reference: order_number,
                orders: createdOrders.map(o => ({
                    uuid: o.uuid,
                    total_amount: o.total_amount,
                    tickets_pdf_url: o.tickets_pdf_url,
                    departure_harbor_name: o.departure_harbor_name,
                    arrival_harbor_name: o.arrival_harbor_name,
                    departure_date: o.departure_date,
                    departure_time: o.departure_time,
                })),
                tickets: allTickets,
                total_amount: +totalAmount.toFixed(2),
                payment_url,
            },
        });
    } catch (error) {
        console.log('createOrderConfirmationController error:', error?.message || error);
        return res.status(500).json({
            status: 500,
            data: { message: error?.message || 'internal error' },
        });
    }
};

const getOrdersByReferenceController = async (req, res) => {
    try {
        const payment_reference = req.query.payment_reference;
        if (!payment_reference) {
            return res.status(400).json({ status: 400, data: { message: 'payment_reference required' } });
        }
        const coreConfig = await getCoreServiceConfigData();
        const salesUrl = coreConfig?.services?.sales?.url;
        const resp = await axios.get(`${salesUrl}/orders`, {
            params: { payment_reference },
            validateStatus: () => true,
        });
        return res.status(resp.status).json(resp.data);
    } catch (error) {
        console.log('getOrdersByReferenceController error:', error?.message || error);
        return res.status(500).json({ status: 500, data: { message: error?.message } });
    }
};

module.exports = {
    createOrderConfirmationController,
    getOrdersByReferenceController,
};
