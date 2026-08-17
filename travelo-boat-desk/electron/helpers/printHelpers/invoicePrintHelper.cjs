const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');
const { systemSettingsDataModel } = require('../../db/models/Settings.cjs');

const { runPrintJob } = require('./printJob.cjs');


const printInvoice = async ({ invoice, items, copy }) => {
    console.log('PRINT INVOICE')
    //console.log(items)
    const settingsData = await systemSettingsDataModel.findOne()
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
                printer.cut();
                printer.beep();
                await sleep(5000); // pauza 1 sekunda
            }
        }
        printer.setCharacterSet(CharacterSet.SLOVENIA);
        printer.alignCenter();
        printer.println(invoice.invoice_client_name);
        printer.println(invoice.invoice_client_address);
        printer.println(invoice.invoice_client_postal_code + ' ' + invoice.invoice_client_town);
        printer.println(invoice.invoice_client_country);
        printer.println("OIB: " + invoice.invoice_client_oib);
        printer.drawLine();
        printer.println(invoice.invoice_business_premise_name);
        printer.println(invoice.invoice_business_premise_address);
        printer.println(invoice.invoice_business_premise_postal_code + ' ' + invoice.invoice_business_premise_postal_town);
        printer.drawLine();
        printer.drawLine();
        printer.alignLeft();
        printer.bold(true);
        printer.alignCenter();
        printer.setTextDoubleHeight();
        if (invoice.invoice_canceled) {
            printer.invert(true); 
            printer.println("     STORNO    ")
            printer.invert(false); 
        }
        if (copy) {
            printer.drawLine();
            printer.println("KOPIJA RAČUNA")
            printer.drawLine();
        }
        printer.setTextDoubleHeight();
        const isR1 = !!invoice.buyer_oib;
        if (isR1) {
            // F2 (R1) račun — nema F1 fiskalni broj; JIR stiže async od YesCor-a.
            printer.println("R1 RAČUN BR: " + invoice.invoice_no + "-" + invoice.invoice_year)
        } else {
            // F1: autoritativni invoice_code dolazi iz backenda u formatu
            // "fiskalNo/BP/BD" (sekvenca per godina × billing_device, preskače R1).
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
        printer.newLine();
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
        printer.drawLine();
        printer.println("U cijenu je uračunato 6% naknade za lučku taksu.");
        printer.println("The price includes 6% of the port tax fee.");
        printer.println("Lučke takse u cijeni su prolazne stavke. Oslobođeno PDV-a prema čl. 33 st.3 zakona i PDV-u. /");
        printer.println("Port taxes in the price are a passing item. Exempt from VAT according to Art. 33 paragraf 3 of the Law on VAT.");
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
        printer.cut();
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
            printer.alignCenter();
            printer.setTextDoubleHeight();
            printer.println('KAPETAN LUKA - KRILO');
            printer.setTextNormal();
            printer.println('P R I J E V O Z N A   K A R T A');
            printer.newLine();
            printer.drawLine();
            printer.alignCenter();
            printer.setTextDoubleHeight();
            if (copy) {
                printer.println("KOPIJA KARTE")
            }
            if (tickets[t].ticket_deactivate) {
                printer.drawLine();
                printer.invert(true);                                       
                printer.println("    KARTA JE STORNIRANA    ")
                printer.invert(false);                                       
            }
            printer.setTextNormal();
            printer.alignLeft();
            printer.newLine();
            printer.drawLine();
            printer.println("Departure/Polazak");
            printer.alignRight();
            printer.println(tickets[t].ticket_departure_harbor_name + ' / ' + tickets[t].ticket_departure);
            printer.alignLeft();
            printer.println("Arrival/Dolazak");
            printer.alignRight();
            printer.println(tickets[t].ticket_arrival_harbor_name + ' / ' + tickets[t].ticket_arrival);
            printer.alignLeft();
            printer.drawLine();
            printer.leftRight("Passanger/Putnik", tickets[t].ticket_type_name);
            printer.drawLine();
            printer.leftRight("Line/Linija", tickets[t].line_name);
            printer.drawLine();
            printer.newLine();
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
                    cellSize: 7,
                    correction: 'M',
                    model: 2
                });
            printer.println(tickets[t].ticket_code)
            printer.alignLeft();
            printer.drawLine();
            printer.println('Dozvoljena osobna prtljaga do 23kg / Maximum luggage weight up to 23kg')
            printer.println('Dužni ste predočiti kartu s kodom prilikom ukrcaja / You are obligated to present the code printed on the ticket while boarding')
            printer.cut();
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
        const invoiceOk = await printInvoice(data)
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
        await printInvoice(data)
    } catch (error) {
        console.log(error)
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