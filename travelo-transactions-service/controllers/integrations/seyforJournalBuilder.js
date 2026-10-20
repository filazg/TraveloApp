// Temeljnica za SAOP (Seyfor iCenter) iz dnevne realizacije.
//
// Oblik omotnice preuzet je iz prvog prototipa (`old/reports_service/
// controllers/erp_integrations/dailyReportsControllers.js`): Accounting →
// AccountingHeader + JournalEntries. Konta se ovdje NE odreduju — stavke stizu
// gotove iz izvjestaja, gdje se konto razrjesava preko sifarnika mapiranja u
// backofficeu. Prototip ih je imao upisane u kod (75144, 7514, 240012, 1009) i
// svaka izmjena kontnog plana trazila bi izmjenu koda.
//
// Jedna temeljnica = jedan dan JEDNOG naplatnog uredaja. Tako dokument u
// iCenteru odgovara jednom obracunu, a ponovno slanje jednog uredaja ne dira
// ostale.

// Oznaka dokumenta. Mora biti jedinstvena po danu i uredaju — inace bi se dva
// uredaja istog dana u iCenteru zvala isto.
const oznakaDokumenta = (datum, costCenter) =>
    `${datum}_${String(costCenter || "n-a").replace(/\s+/g, "")}`;

// Polja stavke i analitike koja AddJournal prima (swagger: JournalEntry,
// JournalAnalytic). Izvjestaj na stavku stavlja i podatke samo za pregled u
// portalu (naziv i OIB kupca, AdvancePeriod) — u SAOP ide samo ovo.
const POLJA_STAVKE = [
    "Analytics", "JournalEntryDate", "JournalEntryDescription", "Account", "Document",
    "LinkToBook", "LinkToNumber", "LinkToOrigin", "LinkToUser", "LinkToYear",
    "Credit", "CreditAmountInDomesticCurrency", "JournalEntryNumber", "SifraStranke",
    "DueDate", "TransactionDate", "TransactionDateTo", "PaymentReference", "Currency",
    "Debit", "DebitAmountInDomesticCurrency", "JournalType", "TurnoverType",
    "FiscalizationType", "FiscalizationDocument", "PaymentType", "ReferenceDocument",
];
const POLJA_ANALITIKE = ["CostCentre", "CostUnit", "Clerk", "WorkOrder", "Analytic1", "Analytic2", "Analytic3"];

const samoPolja = (obj, polja) => {
    const out = {};
    for (const k of polja) {
        if (obj?.[k] === undefined || obj[k] === null) continue;
        out[k] = obj[k];
    }
    return out;
};

const stavkaZaSaop = (e) => {
    const s = samoPolja(e, POLJA_STAVKE);
    if (e?.Analytics) s.Analytics = samoPolja(e.Analytics, POLJA_ANALITIKE);
    return s;
};

// `temeljnica` (iz izvještaja: document, customer, description, entries) je
// jedna od temeljnica uređaja. Svaki R1/F2 račun ide u vlastitu, s kupcem u
// zaglavlju — iCenter stranku stavke uzima odatle (SifraStranke ignorira).
// Bez nje se gradi kao prije, iz svih stavki uređaja.
const izgradiNalog = ({ datum, cc, company, temeljnica = null }) => {
    const stavke = (temeljnica?.entries || cc?.journalEntries || []).map(stavkaZaSaop);
    const opis =
        temeljnica?.description ||
        `dnevni izvještaj ${datum} — ${cc?.billing_device_name || cc?.cost_center || ""}`.trim();

    return {
        Accounting: {
            AccountingHeader: {
                OrganizationId_DK: company?.organization_id ?? 2,
                // Organizacija za PDV evidenciju. Prototip je slao 0 (ne vodi se
                // zasebno), pa dok se ne kaze drukcije ostaje tako.
                OrganizationId_DDV: 0,
                Document: temeljnica?.document || oznakaDokumenta(datum, cc?.cost_center),
                JournalEntryDate: datum,
                // Razdoblje prometa (od–do). Temeljnica pokriva jedan dan, pa
                // su oba ista; bez "do" iCenter razdoblje nije prikazivao dobro.
                TransactionDate: datum,
                TransactionDateTo: datum,
                Customer: temeljnica?.customer || company?.default_customer || "",
                JournalEntryDescription: opis,
                JournalEntriesHeader: {
                    JournalType: "IRA",
                    // 2 = izlazni racuni (6 bi bila ostala knjizenja).
                    TurnoverType: "2",
                    LinkToBook: company?.link_to_book || "",
                    // Poslovna godina knjige — godina dana temeljnice.
                    LinkToYear: Number(String(datum).slice(0, 4)),
                    DueDate: datum,
                },
            },
            JournalEntries: {
                JournalEntry: stavke,
            },
        },
    };
};

// Zbroj duguje/potrazuje. iCenter neuravnotezenu temeljnicu odbija, pa se to
// provjerava prije slanja — greska je tada nasa i vidi se odmah, a ne kroz
// odgovor stranog sustava.
const provjeriRavnotezu = (stavke) => {
    const zbroj = (polje) =>
        (stavke || []).reduce((s, e) => s + Number(e?.[polje] || 0), 0);
    const duguje = Number(zbroj("DebitAmountInDomesticCurrency").toFixed(2));
    const potrazuje = Number(zbroj("CreditAmountInDomesticCurrency").toFixed(2));
    return { duguje, potrazuje, uravnotezena: Math.abs(duguje - potrazuje) < 0.005 };
};

module.exports = { izgradiNalog, provjeriRavnotezu, oznakaDokumenta };
