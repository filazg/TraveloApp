const { SerialPort } = require("serialport");
const fs = require("fs");
const path = require("path");
const { systemSettingsDataModel } = require("../../db/models/Settings.cjs");
   

//
// CONFIG — COM port se čita iz Settings (system_settings.pos_port).
//
const BAUDRATE = 9600;
const ACK = 0x06;
const NAK = 0x15;
const STX = 0x02;
const ETX = 0x03;
const FS = 0x1C;

const SEQ_FILE = path.resolve("./seq.json");
const ACK_TIMEOUT_MS = 3000;
const MAX_RETRIES = 3;

//
// Helperi
//

function closePosPort() {
  try {
    if (port) {
      port.removeAllListeners()
      if (port.isOpen) port.close(() => {})
    }
  } catch (e) {
    console.error('closePosPort error', e)
  }
}


const computeLRC = (buffer) => {
    let lrc = 0x00;
    for (const b of buffer) lrc ^= b;
    return lrc;
};

const zeroPad = (str, len) => str.toString().padStart(len, "0");

const loadSeq = () => {
    try {
        if (!fs.existsSync(SEQ_FILE)) {
            fs.writeFileSync(SEQ_FILE, JSON.stringify({ seq: 1 }, null, 2));
            return 1;
        }
        const raw = fs.readFileSync(SEQ_FILE, "utf8");
        const obj = JSON.parse(raw);
        return Number(obj.seq) || 1;
    } catch (e) {
        console.warn("Ne mogu učitati seq.json, koristiti 1:", e.message);
        return 1;
    }
};

const saveSeq = (n) => {
    fs.writeFileSync(SEQ_FILE, JSON.stringify({ seq: n }, null, 2));
};

//
// BUILD DATA
//
const buildDataBuffer = (spec, seqNum) => {
    const f1 = zeroPad(spec.protocolId, 2).slice(-2);
    const f2 = zeroPad(spec.terminalId, 2).slice(-2);
    const f3 = zeroPad(spec.sourceId, 2).slice(-2);
    const f4 = zeroPad(seqNum, 4).slice(-4);
    const f5 = zeroPad(spec.transactionType, 2).slice(-2);
    const f6 = spec.printerFlag.toString().slice(0, 1);
    const f7 = zeroPad(spec.cashierId, 2).slice(-2);
    const f8 = spec.transactionNumber ? zeroPad(spec.transactionNumber, 6).slice(-6) : "";

    const parts = [];
    const fixedHeader = f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8;
    parts.push(fixedHeader);

    // Polja i FS
    const optionalFields = [
        spec.amount1 || "",
        spec.amount2 || "",
        spec.amount1 ? (spec.amountExponent || "+0") : "",
        spec.amount1 ? (spec.currency || "") : "",
        spec.cardDataSource || "",
        spec.isoTrack2 || "",
        spec.isoTrack1 || "",
        spec.authCode || "",
        spec.tid || "",
        spec.info || ""
    ];

    for (let i = 0; i < optionalFields.length; i++) {
        parts.push(String.fromCharCode(FS));
        parts.push(optionalFields[i]);
    }

    // trailing FS
    parts.push(String.fromCharCode(FS));

    return Buffer.from(parts.join(""), "ascii");
};

//
// SERIAL PORT SETUP
//
let port = null;
let currentPortPath = null;
let rxState = {
    collecting: false,
    dataBuffer: [],
    expectingLRC: false
};
let pendingAck = null;

const handleControlByteDuringWait = (b) => {
    if (!pendingAck) return false;
    if (b === ACK) {
        clearTimeout(pendingAck.timeoutId);
        pendingAck.resolve({ ack: true });
        pendingAck = null;
        return true;
    }
    if (b === NAK) {
        clearTimeout(pendingAck.timeoutId);
        pendingAck.resolve({ ack: false });
        pendingAck = null;
        return true;
    }
    return false;
};

const ensurePort = async (portPath) => {
    //console.log(" port:", port);
    //console.log("Ensuring port:", portPath);
    if (port && port.isOpen && currentPortPath === portPath) 
        return;

    if (port && port.isOpen && currentPortPath !== portPath) {
        console.log("Zatvaranje prethodnog porta:", currentPortPath);
        await new Promise(res => port.close(res));
    }

    port = new SerialPort({
        path: portPath,
        baudRate: BAUDRATE,
        dataBits: 8,
        parity: "none",
        stopBits: 1,
        autoOpen: false
    });

    currentPortPath = portPath;

    // **Premještanje listenera odmah nakon kreiranja porta**
    port.on("data", (data) => {
        console.log("Primljeni podaci:");
        for (const b of data) {
            if (!rxState.collecting && (b === ACK || b === NAK)) {
                if (handleControlByteDuringWait(b)) continue;
            }

            if (b === STX) {
                rxState.collecting = true;
                rxState.dataBuffer = [];
                rxState.expectingLRC = false;
                continue;
            }

            if (!rxState.collecting) continue;

            if (b === ETX) {
                rxState.expectingLRC = true;
                continue;
            }

            if (rxState.expectingLRC) {
                const receivedLRC = b;
                const dataBuf = Buffer.from(rxState.dataBuffer);

                const lrcCalc = computeLRC(Buffer.concat([Buffer.from([STX]), dataBuf, Buffer.from([ETX])]));
                if (lrcCalc === receivedLRC) port.write(Buffer.from([ACK]));
                else port.write(Buffer.from([NAK]));

                try { parsePosResponse(dataBuf); } catch (e) { console.error(e); }

                rxState.collecting = false;
                rxState.dataBuffer = [];
                rxState.expectingLRC = false;
                continue;
            }

            rxState.dataBuffer.push(b);
        }
    });

    await new Promise((resolve, reject) => {
        port.open(err => err ? reject(err) : resolve());
    });

    console.log("Serial port otvoren:", portPath);
};

//
// POS PARSING
//
const parsePosResponse = (dataBuf) => {
    const FS_CHAR = String.fromCharCode(0x1C);
    const ascii = dataBuf.toString("ascii");

    const headerRaw = ascii.slice(0, 36);
    const header = {
        protocolId: headerRaw.slice(0, 2),
        terminalId: headerRaw.slice(2, 4),
        sourceId: headerRaw.slice(4, 6),
        seq: headerRaw.slice(6, 10),
        transactionType: headerRaw.slice(10, 12),
        transactionFlag: headerRaw.slice(12, 14),
        transactionNumber: headerRaw.slice(14, 20),
        batchNumber: headerRaw.slice(20, 24),
        transactionDate: headerRaw.slice(24, 30),
        transactionTime: headerRaw.slice(30, 36)
    };

    let body = ascii.slice(36);
    if (body[0] !== FS_CHAR) {
        const idx = body.indexOf(FS_CHAR);
        body = idx !== -1 ? body.slice(idx) : "";
    }
    body = body.slice(1);
    const rawFields = body.split(FS_CHAR);

    const fieldOrder = [
        "PIN", "transactionAmount1", "transactionAmount2", "amountExponent", "currency",
        "cardDataSource", "cardNumber", "expirationDate", "isoTrack2", "isoTrack1",
        "authorizationSourceCode", "authCode", "authInfo", "tid", "uidNumber",
        "cardType", "transactionName", "currencySymbol", "merchantName", "merchantAddress",
        "debitCreditMessage", "footer", "displayMessage", "hotListNumber", "visaTicketOrISOResponse",
        "tvr", "tsi", "arpc", "nrOfScripts", "authStatus", "aid", "appLabel", "signatureRequired",
        "cvmResults", "atc", "vehicleOrDriverCode", "mileage", "additionalInfo", "statusCode",
        "acquirer", "topUpVoucherData", "transactionIdentifier", "subscriptionData", "banknetTraceNumber"
    ];

    const response = { ...header };
    for (let i = 0; i < fieldOrder.length; i++) response[fieldOrder[i]] = rawFields[i] ?? "";

    console.log("==== PARSIRANI JSON (FULL) ====");
    console.log(JSON.stringify(response, null, 2));
    console.log("==============================");

    return response;
};

//
// SEND FRAME
//
const sendFrameAndWaitAck = async (frameBuffer) => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        await new Promise((res, rej) => {
            port.write(frameBuffer, (err) => {
                if (err) return rej(err);
                port.drain((dErr) => {
                    if (dErr) return rej(dErr);
                    res();
                });
            });
        });

        const ackResult = await new Promise((resolve) => {
            const timeoutId = setTimeout(() => resolve({ timeout: true }), ACK_TIMEOUT_MS);
            pendingAck = { resolve, reject: () => { }, timeoutId };
        });

        if (ackResult.timeout) continue;
        if (ackResult.ack === true) return true;
    }
    return false;
};

function normalizeAmount(value) {
    if (!value) return { amount: "" };
    const num = Number(value);
    if (isNaN(num)) throw new Error(`Neispravan iznos: ${value}`);
    const minorUnits = Math.round(num * 100);
    return { amount: String(minorUnits) };
}

const resetSeqIfNeeded = () => {
    try {
        if (!fs.existsSync(SEQ_FILE)) return;

        const raw = fs.readFileSync(SEQ_FILE, "utf8");
        const { seq } = JSON.parse(raw);

        if (Number(seq) > 5000) {
            fs.unlinkSync(SEQ_FILE);
            console.log("SEQ resetiran (bio > 5000)");
        }
    } catch (e) {
        console.warn("SEQ reset fallback, brišem file:", e.message);
        try { fs.unlinkSync(SEQ_FILE); } catch {
            console.warn("SEQ unlinkSync");
        }
    }
};

async function portExists(portPath) {
  const ports = await SerialPort.list()
  return ports.some(p => (p.path || p.comName) === portPath)
}



const otpPaymentHandler = async (data) => {
    resetSeqIfNeeded();
    console.log('DATA OTP POS',data)
    console.log("isRenderer?", process.type === "renderer");
    console.log("electron", process.versions.electron);
    console.log("node", process.versions.node);
    const settingsData = await systemSettingsDataModel.findOne();
    const comPort = settingsData?.pos_port;
    if (!comPort) {
        throw new Error('POS port nije postavljen u Settings (system_settings.pos_port). Otvori System Settings i odaberi COM port.');
    }
    if (!(await portExists(comPort))) {
        throw new Error(`POS nije spojen (port ${comPort} nije pronađen).`);
    }
    await ensurePort(comPort);


    let seq = loadSeq();
    const seqToUse = data.seq || seq;
    saveSeq(seq + 1);

    const amount1Normalized = normalizeAmount(data.amount1);
    const amount2Normalized = normalizeAmount(data.amount2);

    const messageSpec = {
        protocolId: data.protocolId || "00",
        terminalId: data.terminalId || "00",
        sourceId: data.sourceId || "00",
        transactionType: data.transactionType || "01",
        printerFlag: data.printerFlag || "0",
        //printerFlag: settingsData.pos_print_on_app ? "0":"1",
        cashierId: data.cashierId || "01",
        transactionNumber: data.transactionNumber || "",
        amount1: amount1Normalized.amount || "",
        amount2: amount2Normalized.amount || "",
        amountExponent: data.amountExponent || "",
        currency: data.currency || "",
        cardDataSource: data.cardDataSource || "",
        isoTrack2: data.isoTrack2 || "",
        isoTrack1: data.isoTrack1 || "",
        authCode: data.authCode || "",
        tid: data.tid || "",
        info: data.info || ""
    };

    const dataBuffer = buildDataBuffer(messageSpec, seqToUse);
    const lrcCalc = computeLRC(Buffer.concat([Buffer.from([STX]), dataBuffer, Buffer.from([ETX])]));
    const frame = Buffer.concat([Buffer.from([STX, STX]), dataBuffer, Buffer.from([ETX, lrcCalc])]);

    const ok = await sendFrameAndWaitAck(frame);
    if (!ok) throw new Error("Nije dobiven ACK");

    return new Promise((resolve, reject) => {
        let localBuffer = [];
        const timeout = setTimeout(() => { port.removeListener("data", onData); reject(new Error("Timeout")); }, 90000);

        const onData = (chunk) => {
            for (const b of chunk) {
                if (b === STX) { localBuffer = []; continue; }
                if (b === ETX) {
                    clearTimeout(timeout);
                    port.removeListener("data", onData);
                    try { resolve(parsePosResponse(Buffer.from(localBuffer))); } catch (e) { reject(e); }
                    continue;
                }
                localBuffer.push(b);
            }
        };

        port.on("data", onData);
    });
};


module.exports = { otpPaymentHandler, closePosPort };