// Provideri platnih naloga. SEPA je uvijek prvi jer je povrat na račun, a
// ostali su kartičarske kuće — isti popis kao `card_provider` u šifarniku
// sredstava plaćanja. Kad se u šifarnik doda nova kuća, dodaje se i ovdje.
export const PROVIDERI = [
    {
        key: "SEPA",
        label: "SEPA",
        opis: "Povrat na račun (IBAN)",
        // Nalog banci ide kao pain.001 datoteka; kartičarske kuće dobivaju
        // izvještaj u Excelu.
        datoteka: "xml",
    },
    { key: "MONRI", label: "Monri", opis: "Povrat na karticu — web prodaja", datoteka: "excel" },
    { key: "OTP_POS", label: "OTP POS", opis: "Povrat na karticu — blagajna", datoteka: "excel" },
    { key: "SEVENPAY", label: "7pay", opis: "Povrat na karticu — mobilna", datoteka: "excel" },
];

export const providerPoKljucu = (key) =>
    PROVIDERI.find((p) => p.key === String(key || "").toUpperCase()) || PROVIDERI[0];

export const jeSepa = (key) => String(key || "SEPA").toUpperCase() === "SEPA";
