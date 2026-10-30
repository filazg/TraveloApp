const axios = require("axios");
const { getCoreServiceConfigData } = require("../controllers/configSyncController");

// Naplata racuna.
//
// Sredstvo placanja u backofficeu nosi oznaku "naplaceno pri izdavanju"
// (paid_at_issue). Gotovina i kartica su placene u trenutku izdavanja, virman
// tek kad uplata sjedne — takav racun ostaje neplacen dok ga netko u portalu
// ne potvrdi. Za F2 racune se naplata prijavljuje Poreznoj (YesCor
// document-payment); to radi scheduler, ovdje se samo postavlja stanje.

// YesCor DocumentPaymentType.
const VRSTE_NAPLATE = { TRANSAKCIJSKI: 1, KOMPENZACIJA: 2, OSTALO: 3 };

// Sredstva placanja se mijenjaju rijetko, ali promjena oznake u portalu mora
// vrijediti vec za sljedecu prodaju — zato kratko trajanje.
const TRAJANJE_MS = 60 * 1000;

let spremljeno = null;
let spremljenoU = 0;

const dohvatiSredstva = async () => {
    if (spremljeno && Date.now() - spremljenoU < TRAJANJE_MS) return spremljeno;
    const boUrl = getCoreServiceConfigData()?.services?.backoffice?.url;
    if (!boUrl) return spremljeno || [];
    const r = await axios.get(`${boUrl}/payment_methods`, { timeout: 10000, validateStatus: () => true });
    const popis = r.data?.data?.payment_methods || [];
    // Prazan popis znači da backoffice nije stvarno odgovorio — ne spremaj ga
    // preko valjanog.
    if (!popis.length) return spremljeno || [];
    spremljeno = popis;
    spremljenoU = Date.now();
    return popis;
};

const danUZagrebu = (d) =>
    new Date(d || Date.now()).toLocaleDateString("sv-SE", { timeZone: "Europe/Zagreb" });

// Je li sredstvo "naplaceno pri izdavanju". Kad backoffice ne odgovori ili
// sredstvo ne nade, odlucuje fiskalna oznaka: transakcijski racun (T) se placa
// naknadno, sve ostalo odmah — prodaja ne smije pasti zbog sifarnika.
const naplacenoPriIzdavanju = async (payment_method_uuid, fiscal_mark) => {
    try {
        const pm = payment_method_uuid
            ? (await dohvatiSredstva()).find((x) => x.uuid === payment_method_uuid)
            : null;
        if (pm && pm.paid_at_issue !== undefined && pm.paid_at_issue !== null) {
            return { placeno: pm.paid_at_issue === true, oznaka: pm.payment_type_acr || fiscal_mark };
        }
        if (pm) fiscal_mark = pm.payment_type_acr || fiscal_mark;
    } catch (e) {
        console.log("[naplata] sredstva placanja nisu dohvacena:", e?.message || e);
    }
    return { placeno: String(fiscal_mark || "").toUpperCase() !== "T", oznaka: fiscal_mark };
};

// Polja naplate za novi racun, spremna za InvoiceModel.create.
//   storno — storno racun ne naplacuje nista, pa se ni ne prijavljuje.
const poljaNaplate = async ({ payment_method_uuid, fiscal_mark, invoice_date, storno = false }) => {
    if (storno) {
        return {
            invoice_paid_at_issue: true,
            invoice_paid: true,
            invoice_paid_date: danUZagrebu(invoice_date),
            invoice_paid_type: null,
            yescor_payment_status: "not_applicable",
        };
    }
    const { placeno } = await naplacenoPriIzdavanju(payment_method_uuid, fiscal_mark);
    return placeno
        ? {
            invoice_paid_at_issue: true,
            invoice_paid: true,
            invoice_paid_date: danUZagrebu(invoice_date),
            // Gotovina i kartica nisu ni transakcijski racun ni kompenzacija.
            invoice_paid_type: VRSTE_NAPLATE.OSTALO,
        }
        : {
            invoice_paid_at_issue: false,
            invoice_paid: false,
        };
};

module.exports = { VRSTE_NAPLATE, poljaNaplate, naplacenoPriIzdavanju, danUZagrebu };
