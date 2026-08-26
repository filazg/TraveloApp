const { normalizirajIban } = require("./iban");

// SEPA nalog za e-bankarstvo — ISO 20022 pain.001.001.03 (SEPA Credit Transfer
// Initiation). To je oblik koji hrvatske banke primaju kao datoteku za uvoz
// naloga za plaćanje.
//
// Platitelj je tvrtka (IBAN iz šifarnika tvrtke), primatelji su stavke naloga.
// Jedna stavka = jedna transakcija; ne spajaju se ni kad idu istom primatelju,
// jer svaka nosi svoj storno račun u opisu plaćanja.

const esc = (v) => String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Identifikatori u SEPA poruci smiju sadržavati vrlo uzak skup znakova i
// najviše 35 mjesta. Sve ostalo se izbacuje, da banka ne odbije datoteku.
const oznaka = (v, duljina = 35) => String(v || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, duljina) || "NOTPROVIDED";

// Nazivi i opisi smiju sadržavati samo znakove iz SEPA skupa:
// a-z A-Z 0-9 / - ? : ( ) . , ' + i razmak. Dijakritika se svodi na osnovno
// slovo (Marić → Maric), sve ostalo prelazi u razmak — inače banka zna odbiti
// cijelu datoteku. Znak đ se ne rastavlja NFD-om, pa ide zasebno.
const sepaTekst = (v, duljina) => String(v || "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9/\-?:().,'+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, duljina);

const iznos = (v) => Math.abs(Number(v || 0)).toFixed(2);

const dvoznamenkasto = (n) => String(n).padStart(2, "0");
const isoDatum = (d) => `${d.getFullYear()}-${dvoznamenkasto(d.getMonth() + 1)}-${dvoznamenkasto(d.getDate())}`;
const isoVrijeme = (d) => `${isoDatum(d)}T${dvoznamenkasto(d.getHours())}:${dvoznamenkasto(d.getMinutes())}:${dvoznamenkasto(d.getSeconds())}`;

/**
 * @param {object} p
 * @param {object} p.company   tvrtka iz backofficea (name, iban, swift, address, postal_code, town, legal_id, vat_id)
 * @param {object} p.order     nalog
 * @param {Array}  p.items     stavke naloga
 * @param {Date}   p.now       vrijeme izrade
 * @param {string} p.executionDate  traženi datum izvršenja (YYYY-MM-DD)
 */
const gradiPain001 = ({ company, order, items, now = new Date(), executionDate }) => {
    const ibanPlatitelja = normalizirajIban(company.iban);
    const drzava = ibanPlatitelja.slice(0, 2) || "HR";
    const ukupno = items.reduce((z, s) => z + Math.abs(Number(s.amount || 0)), 0);

    const vrijemeOznake = `${now.getFullYear()}${dvoznamenkasto(now.getMonth() + 1)}${dvoznamenkasto(now.getDate())}${dvoznamenkasto(now.getHours())}${dvoznamenkasto(now.getMinutes())}`;
    const kratkiNalog = oznaka(order.sepa_order_uuid, 8).toUpperCase();
    const msgId = `TRV${kratkiNalog}${vrijemeOznake}`.slice(0, 35);
    const pmtInfId = `${msgId}P`.slice(0, 35);

    // OIB platitelja: vat_id zna doći s prefiksom države, pa se ostavljaju samo
    // znamenke. Blok je neobavezan — ide samo ako OIB postoji.
    const oib = String(company.vat_id || company.legal_id || "").replace(/\D/g, "");

    const transakcije = items.map((s) => {
        const opis = sepaTekst(
            s.description || `Povrat po stornu ${s.storno_invoice_code || ""}`.trim(),
            140
        );
        return [
            `      <CdtTrfTxInf>`,
            `        <PmtId>`,
            `          <EndToEndId>${esc(oznaka(s.sepa_item_uuid, 35))}</EndToEndId>`,
            `        </PmtId>`,
            `        <Amt>`,
            `          <InstdAmt Ccy="EUR">${iznos(s.amount)}</InstdAmt>`,
            `        </Amt>`,
            `        <Cdtr>`,
            `          <Nm>${esc(sepaTekst(s.recipient_name, 70))}</Nm>`,
            `        </Cdtr>`,
            `        <CdtrAcct>`,
            `          <Id>`,
            `            <IBAN>${esc(normalizirajIban(s.recipient_iban))}</IBAN>`,
            `          </Id>`,
            `        </CdtrAcct>`,
            `        <RmtInf>`,
            `          <Ustrd>${esc(opis)}</Ustrd>`,
            `        </RmtInf>`,
            `      </CdtTrfTxInf>`,
        ].join("\n");
    });

    const adresa = [
        company.address ? `          <StrtNm>${esc(sepaTekst(company.address, 70))}</StrtNm>` : null,
        company.postal_code ? `          <PstCd>${esc(sepaTekst(company.postal_code, 16))}</PstCd>` : null,
        company.town ? `          <TwnNm>${esc(sepaTekst(company.town, 35))}</TwnNm>` : null,
        `          <Ctry>${esc(drzava)}</Ctry>`,
    ].filter(Boolean);

    return [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`,
        `  <CstmrCdtTrfInitn>`,
        `    <GrpHdr>`,
        `      <MsgId>${esc(msgId)}</MsgId>`,
        `      <CreDtTm>${isoVrijeme(now)}</CreDtTm>`,
        `      <NbOfTxs>${items.length}</NbOfTxs>`,
        `      <CtrlSum>${ukupno.toFixed(2)}</CtrlSum>`,
        `      <InitgPty>`,
        `        <Nm>${esc(sepaTekst(company.name, 70))}</Nm>`,
        `      </InitgPty>`,
        `    </GrpHdr>`,
        `    <PmtInf>`,
        `      <PmtInfId>${esc(pmtInfId)}</PmtInfId>`,
        `      <PmtMtd>TRF</PmtMtd>`,
        `      <BtchBookg>false</BtchBookg>`,
        `      <NbOfTxs>${items.length}</NbOfTxs>`,
        `      <CtrlSum>${ukupno.toFixed(2)}</CtrlSum>`,
        `      <PmtTpInf>`,
        `        <SvcLvl>`,
        `          <Cd>SEPA</Cd>`,
        `        </SvcLvl>`,
        `      </PmtTpInf>`,
        `      <ReqdExctnDt>${esc(executionDate || isoDatum(now))}</ReqdExctnDt>`,
        `      <Dbtr>`,
        `        <Nm>${esc(sepaTekst(company.name, 70))}</Nm>`,
        `        <PstlAdr>`,
        ...adresa,
        `        </PstlAdr>`,
        ...(oib ? [
            `        <Id>`,
            `          <OrgId>`,
            `            <Othr>`,
            `              <Id>${esc(oib)}</Id>`,
            `              <SchmeNm>`,
            `                <Cd>COID</Cd>`,
            `              </SchmeNm>`,
            `            </Othr>`,
            `          </OrgId>`,
            `        </Id>`,
        ] : []),
        `      </Dbtr>`,
        `      <DbtrAcct>`,
        `        <Id>`,
        `          <IBAN>${esc(ibanPlatitelja)}</IBAN>`,
        `        </Id>`,
        `        <Ccy>EUR</Ccy>`,
        `      </DbtrAcct>`,
        `      <DbtrAgt>`,
        `        <FinInstnId>`,
        // Bez SWIFT-a banka sama prepozna svoj IBAN; oznaka NOTPROVIDED je
        // dogovoreni način da se polje ne izostavi.
        company.swift
            ? `          <BIC>${esc(oznaka(company.swift, 11).toUpperCase())}</BIC>`
            : `          <Othr>\n            <Id>NOTPROVIDED</Id>\n          </Othr>`,
        `        </FinInstnId>`,
        `      </DbtrAgt>`,
        `      <ChrgBr>SLEV</ChrgBr>`,
        ...transakcije,
        `    </PmtInf>`,
        `  </CstmrCdtTrfInitn>`,
        `</Document>`,
        ``,
    ].join("\n");
};

// Ime datoteke: naziv naloga bez dijakritike i razmaka, pa datum.
const imeDatoteke = (order, now = new Date()) => {
    const naziv = String(order?.name || "sepa")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()
        .slice(0, 40) || "sepa";
    return `sepa-${naziv}-${isoDatum(now).replace(/-/g, "")}.xml`;
};

module.exports = { gradiPain001, imeDatoteke };
