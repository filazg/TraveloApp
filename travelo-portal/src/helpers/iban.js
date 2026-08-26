// Provjera IBAN-a po ISO 13616 (mod 97). Ista provjera stoji i na backendu —
// ovdje je da se greška vidi odmah pri unosu, a ne tek nakon slanja.

const DULJINE = {
    AD: 24, AT: 20, BA: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
    EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GR: 27, HR: 21, HU: 28, IE: 22, IS: 26,
    IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, ME: 22, MK: 19, MT: 31, NL: 18,
    NO: 15, PL: 28, PT: 25, RO: 24, RS: 22, SE: 24, SI: 19, SK: 24, SM: 27, TR: 26,
};

export const normalizirajIban = (v) => String(v || "").replace(/[\s-]/g, "").toUpperCase();

export const provjeriIban = (v) => {
    const iban = normalizirajIban(v);
    if (!iban) return { ok: false, razlog: "IBAN nije upisan" };
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return { ok: false, razlog: "IBAN nije u ispravnom obliku" };

    const drzava = iban.slice(0, 2);
    const ocekivana = DULJINE[drzava];
    if (ocekivana && iban.length !== ocekivana) {
        return { ok: false, razlog: `IBAN za ${drzava} ima ${ocekivana} znakova, upisano ih je ${iban.length}` };
    }

    const preslozen = iban.slice(4) + iban.slice(0, 4);
    const brojcano = preslozen.replace(/[A-Z]/g, (s) => String(s.charCodeAt(0) - 55));
    let ostatak = 0;
    for (const znamenka of brojcano) ostatak = (ostatak * 10 + Number(znamenka)) % 97;
    if (ostatak !== 1) return { ok: false, razlog: "kontrolni broj IBAN-a ne odgovara" };

    return { ok: true, iban };
};

// Prikaz u skupinama po četiri znaka — tako se IBAN i čita s papira.
export const formatirajIban = (v) => normalizirajIban(v).replace(/(.{4})/g, "$1 ").trim();
