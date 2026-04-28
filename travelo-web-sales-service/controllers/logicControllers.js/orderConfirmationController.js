const axios = require('axios');
const { getCoreServiceConfigData } = require('../configSyncController');

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

        const totalAmount = createdOrders.reduce(
            (s, o) => s + Number(o.total_amount || 0),
            0
        );

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
