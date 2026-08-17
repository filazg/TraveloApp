// Sunmi V2s internal thermal printer.
// Native bridge binds to woyou.aidlservice.jiuiv5.IWoyouService.
import { NativeModules, Platform } from 'react-native';

const { SunmiPrinter } = NativeModules;
const isAvailable = Platform.OS === 'android' && !!SunmiPrinter;

export const ALIGN = { LEFT: 0, CENTER: 1, RIGHT: 2 };

let bound = false;

export async function bindPrinter() {
    if (!isAvailable) throw new Error('SunmiPrinter not available');
    if (bound) return true;
    const ok = await SunmiPrinter.bind();
    bound = !!ok;
    return bound;
}

export async function initPrinter() {
    await bindPrinter();
    return SunmiPrinter.initPrinter();
}

export async function setAlignment(align) {
    await bindPrinter();
    return SunmiPrinter.setAlignment(align);
}

export async function setFontSize(size) {
    await bindPrinter();
    return SunmiPrinter.setFontSize(size);
}

export async function printText(text) {
    await bindPrinter();
    return SunmiPrinter.printText(text);
}

export async function printQRCode(data, moduleSize = 8, errorLevel = 3) {
    await bindPrinter();
    return SunmiPrinter.printQRCode(data, moduleSize, errorLevel);
}

export async function lineWrap(n = 1) {
    await bindPrinter();
    return SunmiPrinter.lineWrap(n);
}

export async function cutPaper() {
    await bindPrinter();
    return SunmiPrinter.cutPaper();
}

export async function getPrinterStatus() {
    await bindPrinter();
    return SunmiPrinter.getPrinterStatus();
}

// Čeka da printer završi sve AIDL operacije (buffer se isprazni). Sunmi V2s
// firmware vraća različite status vrijednosti pa koristimo pragmatic pristup:
// čekaj da se status stabilizira (isti 3× zaredom) ili maxMs.
export async function waitPrinterIdle(maxMs = 3000, pollMs = 200) {
    if (!isAvailable) return;
    const start = Date.now();
    let lastStatus = null;
    let stableCount = 0;
    while (Date.now() - start < maxMs) {
        try {
            const st = await SunmiPrinter.getPrinterStatus();
            if (st === lastStatus) {
                stableCount += 1;
                if (stableCount >= 3) return true; // 3× isti status = stabiliziran
            } else {
                stableCount = 0;
                lastStatus = st;
            }
        } catch (_) { /* nastavi */ }
        await new Promise((r) => setTimeout(r, pollMs));
    }
    return false;
}

// Sunmi WoyouConsts style keys (vendor-defined ints).
export const STYLE = {
    ENABLE_BOLD: 1000,
    ENABLE_UNDERLINE: 1001,
    ENABLE_ANTI_WHITE: 1002,
    ENABLE_STRIKETHROUGH: 1003,
    ENABLE_ITALIC: 1004,
    ENABLE_INVERT: 1005,
    SET_LINE_SPACING: 2003,
};

export async function setPrinterStyle(key, value) {
    await bindPrinter();
    return SunmiPrinter.setPrinterStyle(key, value);
}

export async function sendRawBytes(bytes) {
    await bindPrinter();
    return SunmiPrinter.sendRAWData(Array.from(bytes));
}

// ESC 7 — set thermal print parameters: max heating dots, heating time, interval.
// max_dots = (n+1)*8 dots active; heating_time in 10us; interval in 10us.
// Defaults: 9, 80, 2 → light. 11, 200, 2 → noticeably darker but slower.
export async function setHeatingParams(maxDots = 11, heatingTime = 200, heatingInterval = 2) {
    return sendRawBytes([0x1B, 0x37, maxDots & 0xFF, heatingTime & 0xFF, heatingInterval & 0xFF]);
}

// Raw ESC/POS QR kod preko sendRAWData — kad AIDL printQRCode ne radi.
// moduleSize: 1-16 (veličina modula u točkama).
// errorLevel: 48=L, 49=M, 50=Q, 51=H (ASCII brojevi).
export async function printRawQR(data, moduleSize = 6, errorLevel = 49) {
    const bytes = String(data || '');
    if (!bytes.length) return;
    // 1) Model: GS ( k pL pH cn fn n1 n2
    //    Funkcija 165: Select model (model 2 = standardni QR)
    await sendRawBytes([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
    // 2) Module size: GS ( k pL pH cn fn n
    //    Funkcija 167: n = 1-16 (veličina u point-ima)
    await sendRawBytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, moduleSize & 0xFF]);
    // 3) Error correction: GS ( k pL pH cn fn n
    //    Funkcija 169: n = 48(L) / 49(M) / 50(Q) / 51(H)
    await sendRawBytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, errorLevel & 0xFF]);
    // 4) Store data: GS ( k pL pH cn fn m d1 d2 ... dk
    //    Funkcija 180: pL + pH*256 = payload_length + 3
    const dataBytes = [];
    for (let i = 0; i < bytes.length; i++) dataBytes.push(bytes.charCodeAt(i) & 0xFF);
    const storeLen = dataBytes.length + 3;
    const pL = storeLen & 0xFF;
    const pH = (storeLen >> 8) & 0xFF;
    await sendRawBytes([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...dataBytes]);
    // 5) Print: GS ( k pL pH cn fn m
    //    Funkcija 181
    await sendRawBytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]);
}

export async function enterPrinterBuffer(clean = true) {
    await bindPrinter();
    return SunmiPrinter.enterPrinterBuffer(clean);
}

export async function commitPrinterBuffer() {
    await bindPrinter();
    return SunmiPrinter.commitPrinterBuffer();
}

export async function exitPrinterBuffer(commit = true) {
    await bindPrinter();
    return SunmiPrinter.exitPrinterBuffer(commit);
}

// High-level native ispisi — sav layout (font, alignment, kolone) je u Kotlin modulu.
// Vidi `SunmiPrinterModule.printReceipt` / `printShiftReport` / `printTickets` za detalje.
export async function nativePrintReceipt(data) {
    await bindPrinter();
    return SunmiPrinter.printReceipt(data);
}
export async function nativePrintShiftReport(data) {
    await bindPrinter();
    return SunmiPrinter.printShiftReport(data);
}
export async function nativePrintTickets(data) {
    await bindPrinter();
    return SunmiPrinter.printTickets(data);
}

export const sunmiPrinterAvailable = isAvailable;

// Serijski broj uređaja za zero-touch uparivanje. Ne treba bind na printer
// servis, pa radi i kad printer nije dostupan. Vraća null umjesto da baca —
// pozivatelj tada jednostavno ide na ručno uparivanje.
export async function getDeviceSerialNumber() {
    if (!isAvailable || !SunmiPrinter.getSerialNumber) return null;
    try {
        const sn = await SunmiPrinter.getSerialNumber();
        return sn ? String(sn).trim() : null;
    } catch (e) {
        console.log('getDeviceSerialNumber:', e?.message || e);
        return null;
    }
}
