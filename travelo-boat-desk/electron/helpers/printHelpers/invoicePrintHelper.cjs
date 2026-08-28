const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');
const { systemSettingsDataModel } = require('../../db/models/Settings.cjs');
const { companyModel } = require('../../db/models/BasicData.cjs');

const { runPrintJob, cutOrFeed } = require('./printJob.cjs');

// F2 (HRFISK20) račun se kupcu dostavlja kao e-račun — na blagajni se ne
// ispisuje ni pri izdavanju ni pri kopiji, na papir idu samo karte. Isto
// pravilo vrijedi na mobilnoj blagajni.
//
// `is_f2` postoji od Taska #91; stariji računi ga nemaju, pa tada vrijedi
// `fiskal_required` koji je do tada nosio istu ulogu.
const isF2Invoice = (invoice) => {
    if (!invoice) return false;
    if (invoice.is_f2 != null) return !!invoice.is_f2;
    if (invoice.fiskal_required != null) return !!invoice.fiskal_required;
    return !!invoice.buyer_oib;
};

// Ispiše redak samo ako ima što ispisati. Bez ovoga prazno polje (npr. adresa
// poslovnog prostora koja se ne popunjava) izađe kao prazan redak na papiru.
const printAko = (printer, value) => {
    const tekst = String(value ?? '').trim();
    if (!tekst) return;
    printer.println(tekst);
};

// Nadopuni tekst razmacima do pune širine retka i centriraj ga. Koristi se uz
// invert(): printer boji samo ono što je ispisano, pa bez nadopune crna
// pozadina stane oko same riječi umjesto preko cijelog retka.
const centriranPunRedak = (tekst, sirina) => {
    const t = String(tekst ?? '');
    if (t.length >= sirina) return t;
    const lijevo = Math.floor((sirina - t.length) / 2);
    return ' '.repeat(lijevo) + t + ' '.repeat(sirina - t.length - lijevo);
};


// Napomena s naplatnog uređaja na dnu ispisa. Definira se u administraciji, po
// uređaju, odvojeno za račun i za kartu — račun ide kupcu, karta putniku, pa
// tekst nije isti. Prazno polje ne ostavlja ni crtu ni prazan redak.
const printNapomena = (printer, tekst) => {
    const napomena = String(tekst ?? '').trim();
    if (!napomena) return;
    printer.drawLine();
    printer.alignCenter();
    for (const redak of napomena.split(String.fromCharCode(10))) {
        if (redak.trim()) printer.println(redak.trim());
    }
    printer.alignLeft();
};

const printInvoice = async ({ invoice, items, copy }) => {
    console.log('PRINT INVOICE')
    //console.log(items)
    const settingsData = await systemSettingsDataModel.findOne()
    const osnovniPodaci = await companyModel.findOne()
    const sirinaIspisa = Number(settingsData.printer_width) || 42;
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    try {
        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            //interface: '//localhost/posprinter1',
            interface: settingsData.printer_location,
            width: Number(settingsData.printer_width), // Number of characters in one line (default 48)
            //width: 48, // Number of characters in one line (default 48)
            characterSet: CharacterSet.SLOVENIA,
            removeSpecialCharacters: true, // Removes special characters - default: false
            lineCharacter: '-', // Use custom character for drawing lines
        });

        if(invoice.payment_data?.tid && settingsData.pos_print_on_app && settingsData.pos_print_additional_slip){
            if(invoice.payment_data?.tid ){
                printer.drawLine();
                printer.drawLine();
                printer.alignCenter();
                printer.println("ISPIS ZA TRGOVCA");
                printer.drawLine();
                printer.println("KARTIČNO TEREĆENJE / CARD PAYMENT");
                printer.alignLeft();
                printer.leftRight("TID: ", invoice.payment_data.tid)
                printer.leftRight("AID", invoice.payment_data.aid)
                printer.leftRight("Datum i vrijeme:", invoice.payment_data.transactionDate.match(/.{2}/g).join(".")+".  "+invoice.payment_data.transactionTime.match(/.{2}/g).join(":"))
                printer.newLine()
                printer.leftRight("Kartica:", invoice.payment_data.cardType)
                printer.leftRight("Br kartice:", invoice.payment_data.cardNumber)
                printer.leftRight("Broj odobrenja" + invoice.payment_data.cardType, invoice.payment_data.authCode)
                printer.bold(true);
                printer.newLine()
                printer.leftRight("IZNOS: ", invoice.invoice_amount.toFixed(2)+" EUR")
                printer.newLine()
                printer.setTextNormal();
                printer.alignCenter();
                printer.setTextDoubleHeight();
                printer.println(invoice.payment_data.displayMessage)
                printer.setTextNormal();
                printer.drawLine();
                printer.println("ISPIS ZA TRGOVCA");
                printer.drawLine();
                printer.drawLine();
                cutOrFeed(printer, settingsData.printer_cut);
                printer.beep();
                await sleep(5000); // pauza 1 sekunda
            }
        }
        printer.setCharacterSet(CharacterSet.SLOVENIA);
        printer.alignCenter();
        // Prazna polja se preskaču. Poslovni prostor npr. često ima samo naziv,
        // a println('') ispiše prazan redak — na računu su to bili prazni redci
        // između naziva poslovnice i crte iznad broja računa.
        printAko(printer, invoice.invoice_client_name);
        printAko(printer, invoice.invoice_client_address);
        printAko(printer, [invoice.invoice_client_postal_code, invoice.invoice_client_town].filter(Boolean).join(' '));
        printAko(printer, invoice.invoice_client_country);
        printAko(printer, invoice.invoice_client_oib && ("OIB: " + invoice.invoice_client_oib));
        printer.drawLine();
        printAko(printer, invoice.invoice_business_premise_name);
        printAko(printer, invoice.invoice_business_premise_address);
        printAko(printer, [invoice.invoice_business_premise_postal_code, invoice.invoice_business_premise_postal_town].filter(Boolean).join(' '));
        // Jedna crta, ne dvije — druga je bila samo dvostruki razdjelnik prije
        // broja računa.
        printer.alignCenter();
        // Kopija se najavljuje IZNAD crte koja odvaja zaglavlje od broja računa,
        // pa ide vlastita crta, natpis, i tek onda crta ispred broja. Prije je
        // natpis stajao ispod te crte, između tri crte za redom.
        if (copy) {
            printer.drawLine();
            // Dvostruka visina, ista kao KOPIJA KARTE. Bold ide POSLIJE promjene
            // veličine — setTextDoubleHeight šalje ESC ! koji ima i bit za
            // podebljanje, pa bi obrnutim redoslijedom pregazio bold.
            printer.setTextDoubleHeight();
            printer.bold(true);
            printer.println("KOPIJA RAČUNA")
            printer.bold(false);
            printer.setTextNormal();
        }
        printer.drawLine();
        printer.bold(true);
        printer.setTextDoubleHeight();
        if (invoice.invoice_canceled) {
            // Tekst se nadopuni do pune širine retka: printer boji samo ono što
            // je ispisano, pa je crna pozadina inače stajala oko same riječi.
            printer.invert(true);
            printer.println(centriranPunRedak("STORNO", sirinaIspisa))
            printer.invert(false);
        }
        if (isF2Invoice(invoice)) {
            // F2 — vidljivi "Račun br" je 8-znakovni kod iz invoice_code; F1
            // sekvenca NO/PP/NU ovdje ne postoji. JIR stiže async od YesCor-a.
            printer.println("F2 RAČUN BR: " + (invoice.invoice_code || '-'))
            printer.setTextNormal();
            printer.println("R1 fiskalizirani račun (HRFISK20)")
            printer.setTextDoubleHeight();
        } else {
            // F1: oznaka "fiskalNo/BP/BD" (sekvenca per godina × billing_device).
            // R1 bez F2 nosi istu oznaku kao i obični račun — razlikuje ga samo
            // blok s podacima o kupcu niže.
            // Fallback (offline mode): složeno iz lokalnih invoice_no + BP + BD.
            const fiscalCode = invoice.invoice_code
                || (invoice.invoice_no + "/" + invoice.invoice_business_premise_fiscal_mark + "/" + invoice.invoice_billing_device_fiscal_mark);
            printer.println("RAČUN BR: " + fiscalCode)
        }
        printer.setTextNormal();
        printer.alignLeft();
        printer.bold(false);
        printer.drawLine();
        printer.leftRight("Datum izdavanja", invoice.invoice_date.toLocaleDateString("en-UK"))
        printer.leftRight("Vrijeme izdavanja", invoice.invoice_date.toLocaleTimeString())
        printer.leftRight("Izdao", invoice.invoice_operator_name)
        printer.leftRight("Sredstvo plaćanja", invoice.invoice_payment_method_name)
        printer.drawLine();
        printer.tableCustom([
            { text: "Stavka", align: "LEFT", },
        ]);
        printer.alignRight();
        printer.tableCustom([
            { text: "Kategorija", align: "LEFT", cols: 18 },
            { text: "Cijena", align: "RIGHT", cols: 12 },
            { text: "Kol", align: "RIGHT", cols: 4 }, //6
            { text: "Iznos", align: "RIGHT", cols: 8 } //12
        ]);
        printer.drawLine();
        printer.alignLeft();
        for (let n = 0; n < items.length; n++) {
            printer.bold(true);
            printer.tableCustom([
                { text: items[n].line_name + ' / ' + items[n].departure_harbor_name + ' -- '+ items[n].arrival_harbor_name + '/' + items[n].departure, align: "LEFT" },
            ]);
            for (let m = 0; m < items[n].tickets_group.length; m++) {
                printer.setTextNormal();
                printer.alignLeft();
                printer.tableCustom([
                    { text: items[n].tickets_group[m].ticket_type_name, align: "LEFT", cols: 18 },
                    { text: items[n].tickets_group[m].single_price.toFixed(2), align: "RIGHT", cols: 12 },
                    { text: items[n].tickets_group[m].quantity, align: "RIGHT", cols: 4 },
                    { text: items[n].tickets_group[m].total_price.toFixed(2), align: "RIGHT", cols: 8 }
                ]);
            }
            printer.alignLeft();
        }
        printer.drawLine();
        printer.alignRight();
        printer.tableCustom([
            { text: 'Osnovice', align: "LEFT", cols: 12 },
            { text: invoice.invoice_vat_base.toFixed(2) + ' EUR', align: "RIGHT", cols: 15 }
        ])
        printer.tableCustom([
            { text: 'PDV 25%', align: "LEFT", cols: 12 },
            { text: invoice.invoice_vat.toFixed(2) + ' EUR', align: "RIGHT", cols: 15 }
        ])
        printer.tableCustom([
            { text: 'Luč. nak', align: "LEFT", cols: 12 },
            { text: invoice.invoice_harbor_tax.toFixed(2) + ' EUR', align: "RIGHT", cols: 15 }
        ])
        printer.setTextDoubleHeight();
        printer.bold(true);
        printer.tableCustom([
            { text: 'Iznos', align: "LEFT", cols: 12 },
            { text: invoice.invoice_amount.toFixed(2) + ' EUR', align: "RIGHT", cols: 15 }
        ])
        printer.setTextNormal();
        printer.alignLeft();
        printer.drawLine();
        if (invoice.buyer_name) {
            printer.println('Kupac:')
            if (invoice.buyer_name) {
                printer.println(invoice.buyer_name)
            }
            if (invoice.buyer_email) {
                printer.println(invoice.buyer_email)
            }
            if (invoice.buyer_company_name) {
                printer.println(invoice.buyer_company_name)
            }
            if (invoice.buyer_address) {
                printer.println(invoice.buyer_address)
            }
            if (invoice.buyer_oib) {
                printer.println(invoice.buyer_oib)
            }
        }
        if(invoice.payment_data?.tid && settingsData.pos_print_on_app){
            if(invoice.payment_data?.tid ){
                printer.drawLine();
                printer.drawLine();
                printer.alignCenter();
                printer.println("KARTIČNO TEREĆENJE / CARD PAYMENT");
                printer.alignLeft();
                printer.leftRight("TID: ", invoice.payment_data.tid)
                printer.leftRight("AID", invoice.payment_data.aid)
                printer.leftRight("Datum i vrijeme:", invoice.payment_data.transactionDate.match(/.{2}/g).join(".")+".  "+invoice.payment_data.transactionTime.match(/.{2}/g).join(":"))
                printer.newLine()
                printer.leftRight("Kartica:", invoice.payment_data.cardType)
                printer.leftRight("Br kartice:", invoice.payment_data.cardNumber)
                printer.leftRight("Broj odobrenja" + invoice.payment_data.cardType, invoice.payment_data.authCode)
                printer.bold(true);
                printer.newLine()
                printer.leftRight("IZNOS: ", invoice.invoice_amount.toFixed(2)+" EUR")
                printer.newLine()
                printer.setTextNormal();
                printer.alignCenter();
                printer.setTextDoubleHeight();
                printer.println(invoice.payment_data.displayMessage)
                printer.setTextNormal();
            }
        }
        printNapomena(printer, osnovniPodaci?.billing_device_footer);
        cutOrFeed(printer, settingsData.printer_cut);
        printer.beep();

        return await runPrintJob(printer, 'RAČUN');
    } catch (error) {
        console.log('PRINT RAČUN — greška pri pripremi ispisa:', error?.message || error)
        return false;
    }
}

const printTickets = async ({ tickets,copy }) => {
    console.log('PRINT TICKETS')
    const settingsData = await systemSettingsDataModel.findOne()
    const osnovniPodaci = await companyModel.findOne()
    try {
        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            //interface: '//localhost/posprinter1',
            interface: settingsData.printer_ticket_location,
            width: Number(settingsData.printer_width), // Number of characters in one line (default 48)
            characterSet: CharacterSet.SLOVENIA,
            removeSpecialCharacters: true, // Removes special characters - default: false
            lineCharacter: '-', // Use custom character for drawing lines
        });
        for (let t = 0; t < tickets.length; t++) {
            // Zaglavlje karte je skraćeno: maknut je prazan redak ispod naslova
            // i prazan redak s drugom crtom prije polaska. KOPIJA i STORNO
            // ostaju — ispisuju se samo kad vrijede, a bez njih se stornirana
            // karta ne razlikuje od važeće.
            //
            // NAPOMENA: naziv je upisan rukom, ne uzima se iz podataka tvrtke.
            // Na drugoj instalaciji karta će i dalje pisati ovo.
            printer.alignCenter();
            printer.setTextDoubleHeight();
            printer.println('KAPETAN LUKA - KRILO');
            printer.setTextNormal();
            printer.println('P R I J E V O Z N A   K A R T A');
            printer.drawLine();
            if (copy) {
                printer.setTextDoubleHeight();
                printer.println("KOPIJA KARTE")
                printer.setTextNormal();
                printer.drawLine();
            }
            if (tickets[t].ticket_deactivate) {
                printer.setTextDoubleHeight();
                printer.invert(true);
                printer.println("    KARTA JE STORNIRANA    ")
                printer.invert(false);
                printer.setTextNormal();
            }
            // Polazak i dolazak u po jednom retku: oznaka lijevo, luka i vrijeme
            // desno. Prije je svaki zauzimao dva retka jer je oznaka bila u
            // svom, a podatak poravnat desno u sljedećem.
            printer.alignLeft();
            printer.leftRight("Dep/Pol", tickets[t].ticket_departure_harbor_name + ' / ' + tickets[t].ticket_departure);
            printer.leftRight("Arr/Dol", tickets[t].ticket_arrival_harbor_name + ' / ' + tickets[t].ticket_arrival);
            printer.drawLine();
            printer.leftRight("Passanger/Putnik", tickets[t].ticket_type_name);
            printer.drawLine();
            printer.leftRight("Line/Linija", tickets[t].line_name);
            printer.drawLine();
            if(tickets[t].ticket_type_name === "MOSI"){
                printer.alignCenter();
                printer.println("PODACI O POVLAŠTENOJ KARTI");
                printer.println("MOSI");
                printer.leftRight("Ime i prezime:", tickets[t].card_data.F2.Ime + ' ' + tickets[t].card_data.F2.Prezime)
                printer.leftRight("OIB:", tickets[t].card_data.F2.OIB)
                printer.leftRight("Ser. br. iskaznice:", tickets[t].card_data.F2.SBr)
                printer.leftRight("Datum izdavanja:", tickets[t].card_data.F2.DatIzdavanja.Day+'/'+tickets[t].card_data.F2.DatIzdavanja.Month+'/'+tickets[t].card_data.F2.DatIzdavanja.Year)
                printer.leftRight("Vrijedi do:", tickets[t].card_data.F2.DatIsteka.Day+'/'+tickets[t].card_data.F2.DatIsteka.Month+'/'+tickets[t].card_data.F2.DatIsteka.Year)
                printer.newLine();
                printer.drawLine();
            }
            if(tickets[t].ticket_type_name === "SEOP"){
                printer.alignCenter();
                printer.println("PODACI O POVLAŠTENOJ KARTI");
                printer.println("SEOP");
                printer.leftRight("Ime i prezime:", tickets[t].card_data.F2.FirstName + ' ' + tickets[t].card_data.F2.Surname)
                printer.leftRight("OIB:", tickets[t].card_data.F2.OIB)
                printer.leftRight("Adresa:", tickets[t].card_data.F2.PermResAddress)
                printer.leftRight("Mjesto:", tickets[t].card_data.F2.PermResName)
                printer.leftRight("Otok:", tickets[t].card_data.F2.IslandName)
                printer.leftRight("Ser. br. iskaznice:", tickets[t].card_data.F2.CardNumber)
                printer.leftRight("Osnovno pravo:", tickets[t].card_data.F2.BasicRight)
                printer.leftRight("Datum izdavanja:", tickets[t].card_data.F2.IssuanceDate.Day+'/'+tickets[t].card_data.F2.IssuanceDate.Month+'/'+tickets[t].card_data.F2.IssuanceDate.Year)
                printer.leftRight("Vrijedi do:", tickets[t].card_data.F2.ExpirationDate.Day+'/'+tickets[t].card_data.F2.ExpirationDate.Month+'/'+tickets[t].card_data.F2.ExpirationDate.Year)
                printer.newLine();
                printer.drawLine();
            }
            if(tickets[t].ticket_type_name === "VIRTUAL CARD"){
                printer.alignCenter();
                printer.println("PODACI O POVLAŠTENOJ KARTI");
                printer.println("VIRTUALNA KARTICA");
                printer.leftRight("Kod:", tickets[t].card_data.code)
                printer.leftRight("Osnovno pravo:", tickets[t].card_data.label)
                printer.leftRight("Broj odobrenja:", tickets[t].card_data.odobrenje)
                printer.alignLeft();
                printer.println("Opis:")
                printer.println(tickets[t].card_data.description)
                printer.newLine();
                printer.drawLine();
            }
            printer.alignCenter();
            printer.printQR(
                tickets[t].ticket_uuid
                + ";" + tickets[t].line_code
                + ";" + tickets[t].ticket_departure_harbor_name
                + ";" + tickets[t].ticket_arrival_harbor_name
                + ";" + tickets[t].ticket_departure_planed
                + ";" + tickets[t].sales_route_uuid
                + ";" + tickets[t].ticket_type_uuid
                , {
                    // Smanjen sa 7. QR nosi dosta podataka (uuid, linija, luke,
                    // vrijeme, ruta, tip karte) pa je bio velik dio karte.
                    cellSize: 5,
                    correction: 'M',
                    model: 2
                });
            printer.println(tickets[t].ticket_code)
            printer.alignLeft();
            printNapomena(printer, osnovniPodaci?.billing_device_ticket_footer);
            cutOrFeed(printer, settingsData.printer_cut);
        }
        printer.beep();

        return await runPrintJob(printer, 'KARTE');
    } catch (error) {
        // Prije je ovaj catch bio prazan, pa neispisana karta nije ostavljala
        // nikakav trag — ni u logu ni na ekranu.
        console.log('PRINT KARTE — greška pri pripremi ispisa:', error?.message || error);
        return false;
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const invoicePrintHelper = async (data) => {
    try {
        // Račun i karte idu na isti printer. Prije se drugi posao slao dok je
        // prvi još bio u prijenosu (execute se nije čekao), pa je karta znala
        // ispasti bez ijedne poruke.
        const skipInvoice = isF2Invoice(data?.invoice);
        if (skipInvoice) {
            console.log('PRINT RAČUN — F2 račun ide kupcu kao e-račun, ispis preskočen.');
        }
        const invoiceOk = skipInvoice ? true : await printInvoice(data)
        await sleep(800);
        const ticketCount = Array.isArray(data?.tickets) ? data.tickets.length : 0;
        if (!ticketCount) {
            console.log('PRINT KARTE — nema karata u računu, ispis preskočen.');
            return { invoice: invoiceOk, tickets: true };
        }
        const ticketsOk = await printTickets(data)
        if (!ticketsOk) {
            console.log('PRINT KARTE — karte nisu ispisane; ponovni ispis je moguć preko kopije karte.');
        }
        return { invoice: invoiceOk, tickets: ticketsOk };
    } catch (error) {
        console.log('invoicePrintHelper greška:', error?.message || error)
        return { invoice: false, tickets: false };
    }
}

const cancelInvoicePrint = async (data) => {
    try {
        console.log('CANCEL INVOICE PRINT......')
        await printInvoice(data)
    } catch (error) {
        console.log(error)
    }
}

const copyInvoicePrint = async (data) => {
    try {
        console.log('cOPY INVOICE PRINT......')
        if (isF2Invoice(data?.invoice)) {
            console.log('KOPIJA RAČUNA — F2 račun se ne ispisuje, kupac ga dobiva kao e-račun.');
            return { printed: false, reason: 'f2' };
        }
        await printInvoice(data)
        return { printed: true };
    } catch (error) {
        console.log(error)
        return { printed: false, reason: 'error' };
    }
}

const copyAllTickets = async (data) => {
    try {
        console.log('cOPY ALL TICKETS......')
        await printTickets(data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    invoicePrintHelper,
    cancelInvoicePrint,
    copyInvoicePrint,
    copyAllTickets,
}