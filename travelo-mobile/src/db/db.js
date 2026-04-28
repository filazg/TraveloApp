import SQLite from 'react-native-sqlite-storage';
import { SCHEMA } from './schema';

SQLite.enablePromise(true);

let _db = null;

export async function openDb() {
    if (_db) return _db;
    _db = await SQLite.openDatabase({ name: 'travelo.db', location: 'default' });
    for (const stmt of SCHEMA) {
        await _db.executeSql(stmt);
    }
    return _db;
}

export async function closeDb() {
    if (_db) {
        await _db.close();
        _db = null;
    }
}

// --- Low-level helpers ---

export async function exec(sql, params = []) {
    const db = await openDb();
    return db.executeSql(sql, params);
}

export async function queryAll(sql, params = []) {
    const [res] = await exec(sql, params);
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
    return rows;
}

export async function queryOne(sql, params = []) {
    const rows = await queryAll(sql, params);
    return rows[0] || null;
}

// Run multiple statements inside a single transaction.
// fn: async (tx) => { tx.executeSql(...); ... }
export async function runInTransaction(fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        db.transaction(
            (tx) => { Promise.resolve(fn(tx)).catch(reject); },
            reject,
            resolve
        );
    });
}

// Bulk upsert helper for tables whose columns are (key + misc + payload + updated_at).
// Uses INSERT OR REPLACE which is safe with PRIMARY KEY.
export async function upsertMany(tableName, keyCol, rows, mapRow) {
    if (!rows || !rows.length) return 0;
    const db = await openDb();
    const now = new Date().toISOString();
    await new Promise((resolve, reject) => {
        db.transaction(
            (tx) => {
                for (const r of rows) {
                    const mapped = mapRow(r, now);
                    const cols = Object.keys(mapped);
                    const placeholders = cols.map(() => '?').join(',');
                    const values = cols.map((c) => mapped[c]);
                    tx.executeSql(
                        `INSERT OR REPLACE INTO ${tableName} (${cols.join(',')}) VALUES (${placeholders});`,
                        values
                    );
                }
            },
            reject,
            resolve
        );
    });
    return rows.length;
}

// --- Settings (k/v) convenience ---

export async function setSetting(key, value) {
    await exec(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);`,
        [key, value == null ? null : String(value)]
    );
}

export async function getSetting(key) {
    const row = await queryOne(`SELECT value FROM settings WHERE key = ?;`, [key]);
    return row?.value ?? null;
}

export async function clearSetting(key) {
    await exec(`DELETE FROM settings WHERE key = ?;`, [key]);
}
