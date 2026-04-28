// Table-create SQL. Each table is idempotent (CREATE IF NOT EXISTS).
// Columns use TEXT for everything except numeric aggregates — SQLite is permissive
// and we store JSON blobs for anything we don't query on.

export const SCHEMA = [
    // Local K/V for misc settings (gateway URL, token, last sync, etc.)
    `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
    );`,

    // basic_data — single-row cached snapshot.
    `CREATE TABLE IF NOT EXISTS basic_data (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS users (
        uuid TEXT PRIMARY KEY,
        username TEXT,
        name TEXT,
        surname TEXT,
        code TEXT,
        mark TEXT,
        password_hash TEXT,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS payment_methods (
        uuid TEXT PRIMARY KEY,
        name TEXT,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS harbors (
        code TEXT PRIMARY KEY,
        name TEXT,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS lines (
        uuid TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS sales_routes (
        uuid TEXT PRIMARY KEY,
        line_code TEXT,
        timetable_uuid TEXT,
        sequence INTEGER,
        departure_date TEXT,
        departure_time TEXT,
        departure_harbor_id TEXT,
        arrival_harbor_id TEXT,
        departure_harbor_order INTEGER,
        arrival_harbor_order INTEGER,
        direction TEXT,
        is_active INTEGER,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_routes_line_date ON sales_routes(line_code, departure_date);`,
    `CREATE INDEX IF NOT EXISTS idx_routes_timetable_seq ON sales_routes(timetable_uuid, sequence);`,

    `CREATE TABLE IF NOT EXISTS trips_prices (
        uuid TEXT PRIMARY KEY,
        timetable_uuid TEXT,
        harbor_from_code TEXT,
        harbor_to_code TEXT,
        ticket_type_uuid TEXT,
        price REAL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_prices_timetable ON trips_prices(timetable_uuid);`,

    // Issued invoices (offline-capable). `synced = 0` means waiting to be uploaded.
    `CREATE TABLE IF NOT EXISTS invoices (
        invoice_uuid TEXT PRIMARY KEY,
        order_uuid TEXT,
        shift_uuid TEXT,
        operator_uuid TEXT,
        voyage_key TEXT,
        created_at TEXT NOT NULL,
        amount REAL,
        synced INTEGER DEFAULT 0,
        payload TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_shift ON invoices(shift_uuid);`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_synced ON invoices(synced);`,

    // Sold tickets — one row per ticket. Linked to invoice + order.
    `CREATE TABLE IF NOT EXISTS tickets (
        ticket_uuid TEXT PRIMARY KEY,
        ticket_code TEXT,
        order_uuid TEXT,
        invoice_uuid TEXT,
        shift_uuid TEXT,
        route_uuid TEXT,
        departure_planed TEXT,
        validated_at TEXT,
        validated_by TEXT,
        is_canceled INTEGER DEFAULT 0,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_route ON tickets(route_uuid);`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_shift ON tickets(shift_uuid);`,

    // Adresar kupaca — spremaju se podaci R1 kupaca za brzi izbor u sljedećoj prodaji.
    `CREATE TABLE IF NOT EXISTS buyers (
        oib TEXT PRIMARY KEY,
        name TEXT,
        address TEXT,
        postal_code TEXT,
        town TEXT,
        email TEXT,
        last_used_at TEXT NOT NULL,
        payload TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_buyers_recent ON buyers(last_used_at DESC);`,

    // Operator shifts (zaključci prometa).
    `CREATE TABLE IF NOT EXISTS shifts (
        shift_uuid TEXT PRIMARY KEY,
        operator_uuid TEXT,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        totals TEXT,  -- JSON with per-payment-method totals, counts etc.
        synced INTEGER DEFAULT 0
    );`,
    `CREATE INDEX IF NOT EXISTS idx_shifts_open ON shifts(closed_at);`,
];
