// CRUD helpers per entity. Each table stores the full payload as JSON in `payload`
// so UI code can consume the same shape it got from the API.
import { exec, queryAll, queryOne, upsertMany, getSetting, setSetting } from './db';

const nowIso = () => new Date().toISOString();

// ---------- BASIC DATA ----------
export async function saveBasicData(basicData, users, paymentMethods) {
    if (basicData) {
        await exec(
            `INSERT OR REPLACE INTO basic_data (id, payload, updated_at) VALUES (1, ?, ?);`,
            [JSON.stringify(basicData), nowIso()]
        );
    }
    if (Array.isArray(users)) {
        await exec(`DELETE FROM users;`);
        await upsertMany('users', 'uuid', users, (u, now) => ({
            uuid: u.user_uuid,
            username: u.user_username,
            name: u.user_name,
            surname: u.user_surname,
            code: u.user_code,
            mark: u.user_mark,
            password_hash: u.user_password,
            payload: JSON.stringify(u),
            updated_at: now,
        }));
    }
    if (Array.isArray(paymentMethods)) {
        await exec(`DELETE FROM payment_methods;`);
        await upsertMany('payment_methods', 'uuid', paymentMethods, (p, now) => ({
            uuid: p.uuid,
            name: p.name || '',
            payload: JSON.stringify(p),
            updated_at: now,
        }));
    }
}

export async function loadBasicData() {
    const row = await queryOne(`SELECT payload FROM basic_data WHERE id = 1;`);
    const basicData = row ? JSON.parse(row.payload) : null;
    const userRows = await queryAll(`SELECT payload FROM users ORDER BY username;`);
    const users = userRows.map((r) => JSON.parse(r.payload));
    const payRows = await queryAll(`SELECT payload FROM payment_methods ORDER BY name;`);
    const paymentMethods = payRows.map((r) => JSON.parse(r.payload));
    return { basicData, users, paymentMethods };
}

// ---------- TRANSPORT DATA ----------
export async function saveTransportData({ harbors, lines, salesRoutes, tripsPrices }) {
    if (Array.isArray(harbors)) {
        await exec(`DELETE FROM harbors;`);
        await upsertMany('harbors', 'code', harbors, (h, now) => ({
            code: h.code,
            name: h.name || '',
            payload: JSON.stringify(h),
            updated_at: now,
        }));
    }
    if (Array.isArray(lines)) {
        await exec(`DELETE FROM lines;`);
        await upsertMany('lines', 'uuid', lines, (l, now) => ({
            uuid: l.uuid,
            code: l.code || '',
            name: l.name || '',
            payload: JSON.stringify(l),
            updated_at: now,
        }));
    }
    if (Array.isArray(salesRoutes)) {
        await exec(`DELETE FROM sales_routes;`);
        await upsertMany('sales_routes', 'uuid', salesRoutes, (r, now) => ({
            uuid: r.uuid,
            line_code: r.line_code || '',
            timetable_uuid: r.timetable_uuid || '',
            sequence: r.sequence || 0,
            departure_date: r.departure_date || '',
            departure_time: r.departure_time || '',
            departure_harbor_id: r.departure_harbor_id || '',
            arrival_harbor_id: r.arrival_harbor_id || '',
            departure_harbor_order: Number(r.departure_harbor_order) || 0,
            arrival_harbor_order: Number(r.arrival_harbor_order) || 0,
            direction: r.direction || '',
            is_active: r.is_active ? 1 : 0,
            payload: JSON.stringify(r),
            updated_at: now,
        }));
    }
    if (Array.isArray(tripsPrices)) {
        await exec(`DELETE FROM trips_prices;`);
        await upsertMany('trips_prices', 'uuid', tripsPrices, (p, now) => ({
            uuid: p.uuid,
            timetable_uuid: p.timetable_uuid || '',
            harbor_from_code: p.harbor_from_code || '',
            harbor_to_code: p.harbor_to_code || '',
            ticket_type_uuid: p.ticket_type_uuid || '',
            price: Number(p.price) || 0,
            payload: JSON.stringify(p),
            updated_at: now,
        }));
    }
}

export async function loadTransportData() {
    const h = await queryAll(`SELECT payload FROM harbors ORDER BY name;`);
    const l = await queryAll(`SELECT payload FROM lines ORDER BY code;`);
    const r = await queryAll(`SELECT payload FROM sales_routes WHERE is_active = 1;`);
    const p = await queryAll(`SELECT payload FROM trips_prices;`);
    return {
        harbors: h.map((x) => JSON.parse(x.payload)),
        lines: l.map((x) => JSON.parse(x.payload)),
        salesRoutes: r.map((x) => JSON.parse(x.payload)),
        tripsPrices: p.map((x) => JSON.parse(x.payload)),
    };
}

// ---------- INVOICES + TICKETS ----------
export async function saveSale({ invoice, tickets }) {
    if (invoice) {
        await exec(
            `INSERT OR REPLACE INTO invoices
             (invoice_uuid, order_uuid, shift_uuid, operator_uuid, voyage_key, created_at, amount, synced, payload)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
                invoice.invoice_uuid,
                invoice.order_uuid || null,
                invoice.shift_uuid || null,
                invoice.operator_uuid || null,
                invoice.voyage_key || null,
                invoice.created_at || nowIso(),
                Number(invoice.amount) || 0,
                invoice.synced ? 1 : 0,
                JSON.stringify(invoice),
            ]
        );
    }
    if (Array.isArray(tickets) && tickets.length) {
        for (const t of tickets) {
            await exec(
                `INSERT OR REPLACE INTO tickets
                 (ticket_uuid, ticket_code, order_uuid, invoice_uuid, shift_uuid, route_uuid, departure_planed, validated_at, validated_by, is_canceled, payload, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                [
                    t.ticket_uuid,
                    t.ticket_code || null,
                    t.order_uuid || null,
                    t.invoice_uuid || invoice?.invoice_uuid || null,
                    t.shift_uuid || invoice?.shift_uuid || null,
                    t.route_uuid || null,
                    t.departure_planed || null,
                    t.validated_at || null,
                    t.validated_by || null,
                    t.is_canceled ? 1 : 0,
                    JSON.stringify(t),
                    t.created_at || nowIso(),
                ]
            );
        }
    }
}

export async function loadInvoices(limit = 100) {
    const rows = await queryAll(
        `SELECT payload, synced FROM invoices ORDER BY created_at DESC LIMIT ?;`,
        [limit]
    );
    return rows.map((r) => ({ ...JSON.parse(r.payload), _synced: r.synced === 1 }));
}

// Dohvati sve karte vezane uz pojedini račun (za detail/reprint).
export async function loadTicketsForInvoice(invoiceUuid) {
    if (!invoiceUuid) return [];
    const rows = await queryAll(
        `SELECT payload FROM tickets WHERE invoice_uuid = ? ORDER BY created_at ASC;`,
        [invoiceUuid]
    );
    return rows.map((r) => JSON.parse(r.payload));
}

// Označi tickete storniranima i ažuriraj invoice payload (sav ili djelomični storno).
// stornoMeta: { invoice_uuid, storno_invoice_uuid, storno_invoice_no, storno_amount, percentage }
export async function markTicketsCanceled(ticketUuids, stornoMeta) {
    if (!Array.isArray(ticketUuids) || !ticketUuids.length) return 0;
    let count = 0;
    for (const uuid of ticketUuids) {
        const row = await queryOne(`SELECT payload FROM tickets WHERE ticket_uuid = ?;`, [uuid]);
        if (!row) continue;
        const t = JSON.parse(row.payload);
        t.is_canceled = true;
        t.status = 'canceled';
        t.storno_invoice_uuid = stornoMeta?.storno_invoice_uuid || null;
        await exec(
            `UPDATE tickets SET is_canceled = 1, payload = ? WHERE ticket_uuid = ?;`,
            [JSON.stringify(t), uuid]
        );
        count += 1;
    }
    return count;
}

// Označi cijeli račun stornoiranim u lokalnoj bazi + spremi storno meta na payload.
export async function markInvoiceCanceled(invoiceUuid, stornoMeta) {
    const row = await queryOne(`SELECT payload FROM invoices WHERE invoice_uuid = ?;`, [invoiceUuid]);
    if (!row) return false;
    const cur = JSON.parse(row.payload);
    cur.is_canceled = true;
    cur.storno = stornoMeta || cur.storno || null;
    await exec(`UPDATE invoices SET payload = ? WHERE invoice_uuid = ?;`, [JSON.stringify(cur), invoiceUuid]);
    return true;
}

// Cleanup: zadržava `keep` najnovijih računa. Stari, ali SAMO oni koji su
// potvrđeno poslani backendu (synced = 1), brišu se zajedno s tickets-ima.
// Pendingi (synced = 0) ostaju netaknuti — ne smije se izgubiti račun koji nije sinkroniziran.
export async function pruneOldSyncedInvoices(keep = 100) {
    const total = await queryOne(`SELECT COUNT(*) AS c FROM invoices;`);
    const totalCount = total?.c || 0;
    if (totalCount <= keep) return { deleted: 0, kept: totalCount };

    // Uvodi se prag: created_at N-tog najnovijeg računa.
    const cutoff = await queryOne(
        `SELECT created_at FROM invoices ORDER BY created_at DESC LIMIT 1 OFFSET ?;`,
        [keep - 1]
    );
    if (!cutoff?.created_at) return { deleted: 0, kept: totalCount };

    const toDelete = await queryAll(
        `SELECT invoice_uuid FROM invoices WHERE synced = 1 AND created_at < ?;`,
        [cutoff.created_at]
    );
    if (!toDelete.length) return { deleted: 0, kept: totalCount };

    const placeholders = toDelete.map(() => '?').join(',');
    const uuids = toDelete.map((r) => r.invoice_uuid);
    await exec(`DELETE FROM tickets WHERE invoice_uuid IN (${placeholders});`, uuids);
    await exec(`DELETE FROM invoices WHERE invoice_uuid IN (${placeholders});`, uuids);
    return { deleted: uuids.length, kept: totalCount - uuids.length };
}

export async function loadTicketsForVoyageKey(voyageKey, limit = 500) {
    const rows = await queryAll(
        `SELECT t.payload FROM tickets t
         JOIN invoices i ON i.invoice_uuid = t.invoice_uuid
         WHERE i.voyage_key = ? AND (t.is_canceled = 0 OR t.is_canceled IS NULL)
         ORDER BY t.created_at DESC LIMIT ?;`,
        [voyageKey, limit]
    );
    return rows.map((r) => JSON.parse(r.payload));
}

export async function findTicketByCode(code) {
    const r = await queryOne(`SELECT payload FROM tickets WHERE ticket_code = ? OR ticket_uuid = ?;`, [code, code]);
    return r ? JSON.parse(r.payload) : null;
}

// Upsert tickets dohvaćene s bekenda za odabrani polazak (svi prodajni kanali).
// Ne dira `invoice_uuid` ako lokalni ticket već postoji (čuva vezu na lokalni račun
// kad je karta i lokalno prodana). Validacija statusa ide preko `validated_at`.
export async function upsertExternalTickets(tickets) {
    if (!Array.isArray(tickets) || !tickets.length) return 0;
    let count = 0;
    for (const t of tickets) {
        const validatedAt = t.validate_data || (t.status === 'validated' ? nowIso() : null);
        const isCanceled = t.is_canceled || t.status === 'canceled' ? 1 : 0;
        // Pokušaj očuvati lokalni invoice_uuid ako već imamo zapis za ovu kartu.
        const existing = await queryOne(`SELECT invoice_uuid FROM tickets WHERE ticket_uuid = ?;`, [t.ticket_uuid]);
        const invUuid = existing?.invoice_uuid || t.invoice_uuid || null;
        await exec(
            `INSERT OR REPLACE INTO tickets
             (ticket_uuid, ticket_code, order_uuid, invoice_uuid, shift_uuid, route_uuid, departure_planed, validated_at, validated_by, is_canceled, payload, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
                t.ticket_uuid,
                t.ticket_code || null,
                t.order_uuid || null,
                invUuid,
                t.shift_uuid || null,
                t.route_uuid || null,
                t.departure_planed || null,
                validatedAt,
                t.validated_by || null,
                isCanceled,
                JSON.stringify(t),
                t.created_at || nowIso(),
            ]
        );
        count += 1;
    }
    return count;
}

// Sve karte za dani skup ruta (polazak može imati više etapa = više route_uuid-eva).
export async function loadTicketsForRoutes(routeUuids) {
    if (!Array.isArray(routeUuids) || !routeUuids.length) return [];
    const placeholders = routeUuids.map(() => '?').join(',');
    const rows = await queryAll(
        `SELECT payload FROM tickets WHERE route_uuid IN (${placeholders}) AND (is_canceled = 0 OR is_canceled IS NULL);`,
        routeUuids
    );
    return rows.map((r) => JSON.parse(r.payload));
}

// Označi kartu validiranom lokalno + ažuriraj payload.status.
export async function markTicketValidatedLocal(ticketUuid, validatedAt) {
    const row = await queryOne(`SELECT payload FROM tickets WHERE ticket_uuid = ?;`, [ticketUuid]);
    if (!row) return false;
    const payload = JSON.parse(row.payload);
    payload.status = 'validated';
    payload.validate_data = validatedAt;
    await exec(
        `UPDATE tickets SET validated_at = ?, payload = ? WHERE ticket_uuid = ?;`,
        [validatedAt, JSON.stringify(payload), ticketUuid]
    );
    return true;
}

export async function findTicketByUuidOrCode(needle) {
    const r = await queryOne(
        `SELECT payload FROM tickets WHERE ticket_uuid = ? OR ticket_code = ?;`,
        [needle, needle]
    );
    return r ? JSON.parse(r.payload) : null;
}

// ---------- OFFLINE QUEUE ----------
export async function loadPendingInvoices(limit = 100) {
    const rows = await queryAll(
        `SELECT payload FROM invoices WHERE synced = 0 ORDER BY created_at ASC LIMIT ?;`,
        [limit]
    );
    return rows.map((r) => JSON.parse(r.payload));
}

export async function countPendingInvoices() {
    const r = await queryOne(`SELECT COUNT(*) AS c FROM invoices WHERE synced = 0;`);
    return r?.c || 0;
}

// ---------- ADRESAR (BUYERS) ----------
// Spremaju se podaci R1 kupaca nakon uspješne prodaje — za brzi izbor idući put.
export async function saveBuyer(buyer) {
    if (!buyer?.buyer_oib) return false;
    const payload = {
        name: buyer.buyer_name || buyer.buyer_company_name || '',
        oib: buyer.buyer_oib,
        address: buyer.buyer_address || '',
        postal_code: buyer.buyer_postal_code || '',
        town: buyer.buyer_town || '',
        email: buyer.buyer_email || '',
    };
    await exec(
        `INSERT OR REPLACE INTO buyers
         (oib, name, address, postal_code, town, email, last_used_at, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
            payload.oib,
            payload.name,
            payload.address,
            payload.postal_code,
            payload.town,
            payload.email,
            nowIso(),
            JSON.stringify(payload),
        ]
    );
    return true;
}

export async function loadRecentBuyers(limit = 50) {
    const rows = await queryAll(
        `SELECT payload FROM buyers ORDER BY last_used_at DESC LIMIT ?;`,
        [limit]
    );
    return rows.map((r) => JSON.parse(r.payload));
}

// Batch upsert buyers iz backend sync-a (listBuyers endpoint).
export async function upsertBuyersFromSync(buyers) {
    if (!Array.isArray(buyers) || !buyers.length) return 0;
    let count = 0;
    for (const b of buyers) {
        if (!b?.oib) continue;
        const payload = {
            name: b.name || '',
            oib: b.oib,
            address: b.address || '',
            postal_code: b.postal_code || '',
            town: b.town || '',
            email: b.email || '',
        };
        await exec(
            `INSERT OR REPLACE INTO buyers
             (oib, name, address, postal_code, town, email, last_used_at, payload)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
            [
                payload.oib,
                payload.name,
                payload.address,
                payload.postal_code,
                payload.town,
                payload.email,
                b.last_used_at || nowIso(),
                JSON.stringify(payload),
            ]
        );
        count += 1;
    }
    return count;
}

// Replace synced flag + merge backend response onto local payload so we upgrade
// local invoice_no / fiskal_no to the official server-issued ones.
export async function markInvoiceSynced(localInvoiceUuid, backendResponse) {
    const row = await queryOne(`SELECT payload FROM invoices WHERE invoice_uuid = ?;`, [localInvoiceUuid]);
    if (!row) return false;
    const cur = JSON.parse(row.payload);
    const merged = { ...cur, synced: 1, backend: backendResponse };
    await exec(
        `UPDATE invoices SET synced = 1, payload = ? WHERE invoice_uuid = ?;`,
        [JSON.stringify(merged), localInvoiceUuid]
    );
    return true;
}

// ---------- SETTINGS (token, gateway) ----------
export const STORAGE_KEYS = {
    GATEWAY: 'gateway_url',
    TOKEN: 'terminal_token',
    LAST_SYNC_AT: 'last_sync_at',
};

export async function saveToken(token) { await setSetting(STORAGE_KEYS.TOKEN, token); }
export async function loadToken() { return getSetting(STORAGE_KEYS.TOKEN); }
export async function clearToken() { await setSetting(STORAGE_KEYS.TOKEN, null); }
export async function saveGateway(url) { await setSetting(STORAGE_KEYS.GATEWAY, url); }
export async function loadGateway() { return getSetting(STORAGE_KEYS.GATEWAY); }
