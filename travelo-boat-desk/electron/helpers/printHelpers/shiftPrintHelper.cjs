const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');
const { systemSettingsDataModel } = require('../../db/models/Settings.cjs');
const { runPrintJob, cutOrFeed } = require('./printJob.cjs');

const date = new Date()

// Ispiši samo ako ima što — prazna polja bi inače izašla kao prazni redci.
const printAko = (printer, value) => {
    const tekst = String(value ?? '').trim();
    if (!tekst) return;
    printer.println(tekst);
};
const leftRightAko = (printer, label, value) => {
    const tekst = String(value ?? '').trim();
    if (!tekst) return;
    printer.leftRight(label, tekst);
};

// Format se slaže izričito, ne prepušta lokalnim postavkama računala — isti
// oblik kao na mobilnoj blagajni.
const dva = (n) => String(n).padStart(2, '0');
const uDatum = (value) => (value instanceof Date ? value : new Date(value));
const formatDatum = (value) => {
    const d = uDatum(value);
    if (!d || Number.isNaN(d.getTime())) return '';
    return `${dva(d.getDate())}.${dva(d.getMonth() + 1)}.${d.getFullYear()}`;
};
const formatVrijeme = (value) => {
    const d = uDatum(value);
    if (!d || Number.isNaN(d.getTime())) return '';
    return `${dva(d.getHours())}:${dva(d.getMinutes())}:${dva(d.getSeconds())}`;
};

const shiftPrintHelper = async (data) => {
    console.log("SHIFT PRINT DATA:", data)
    const settingsData = await systemSettingsDataModel.findOne()
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
        printer.setCharacterSet(CharacterSet.SLOVENIA);
        printer.alignCenter();
        // Prazna polja se preskaču — kao na mobilnoj. Prije su izlazila kao
        // prazni redci; poslovni prostor npr. često ima samo naziv.
        printAko(printer, data.shift.client_name);
        printAko(printer, data.shift.client_address);
        printAko(printer, [data.shift.client_postal_code, data.shift.client_town].filter(Boolean).join(' '));
        printAko(printer, data.shift.client_country);
        printAko(printer, data.shift.client_oib && ('OIB: ' + data.shift.client_oib));
        printer.drawLine();
        printer.alignLeft();
        printer.println('POSLOVNI PROSTOR:');
        leftRightAko(printer, 'Naziv:', data.shift.business_premise_name);
        leftRightAko(printer, 'Adresa:', data.shift.business_premise_address);
        leftRightAko(printer, 'Mjesto:', [data.shift.business_premise_postal_code, data.shift.business_premise_postal_town].filter(Boolean).join(' '));
        leftRightAko(printer, 'Oznaka poslovnice:', data.shift.business_premise_fiscal_mark);
        leftRightAko(printer, 'Oznaka blagajne:', data.shift.billing_device_fiscal_mark);
        printer.drawLine();
        // Napomena se ispisuje samo ako postoji — inače je izlazio prazan redak
        // ispod naslova.
        if (String(data.shift.remark || '').trim()) {
            printer.println('NAPOMENA:');
            printer.println(String(data.shift.remark).trim());
            printer.drawLine();
        }
        printer.alignCenter();
        // Naknadni ispis se označava, kao na mobilnoj — inače se kopija ne
        // razlikuje od zaključka koji je izašao pri zatvaranju smjene.
        if (data.copy) {
            printer.setTextDoubleHeight();
            printer.bold(true);
            printer.println("KOPIJA");
            printer.bold(false);
            printer.setTextNormal();
            printer.drawLine();
        }
        printer.bold(true);
        printer.setTextDoubleHeight();
        printer.println("ZAKLJUČAK BR: "+ data.shift.id);
        printer.setTextNormal();
        printer.alignLeft();
        printer.bold(false);
        printer.drawLine();
        printer.leftRight("Operater", data.shift.operater_name + ' ' + data.shift.operater_surname)
        printer.drawLine();
        // Datum i vrijeme se slažu izričito, kao na mobilnoj. Prije je stajalo
        // toLocaleDateString("en-UK") — "UK" nije važeća oznaka regije (ispravno
        // je "GB"), pa je format ovisio o postavkama računala.
        printer.leftRight("Datum otvaranja smjene", formatDatum(data.shift.shift_start))
        printer.leftRight("Vrijeme otvaranja smjene", formatVrijeme(data.shift.shift_start))
        printer.leftRight("Datum zatvaranja smjene", formatDatum(data.shift.shift_end))
        printer.leftRight("Vrijeme zatvaranja smjene", formatVrijeme(data.shift.shift_end))
        leftRightAko(printer, "Br. prvog računa", data.shift.shift_first_invoice)
        leftRightAko(printer, "Br. zadnjeg računa", data.shift.shift_last_invoice)
        printer.drawLine();
        // PRIVREMENO SAKRIVENO — mobilna te dvije sekcije na ispisu nema, pa se
        // zaključci nisu poklapali. Podaci se i dalje računaju (line_details i
        // deacttive_line_detials dolaze u `data`), samo se ne ispisuju; za
        // vraćanje je dovoljno maknuti `false &&` iz oba uvjeta.
        if(false && data.line_details && data.line_details.length > 0){
            //PRODANE KARTE

            printer.newLine();
            printer.alignCenter();
            printer.println("PRODANE KARTE")
            
            
            printer.alignLeft();
            printer.println('Linija: ');
            printer.leftRight('Kategorija (kol):', 'Iznos')
            for (let n = 0; n < data.line_details.length; n++) {
                printer.drawLine();
                printer.alignLeft();
                printer.println('('+ data.line_details[n].line_code +') - ' + data.line_details[n].line_name);
                printer.alignLeft();
                for (let c = 0; c < data.line_details[n].tickets_details.length; c++) {
                    printer.leftRight(data.line_details[n].tickets_details[c].category_name +'('+ data.line_details[n].tickets_details[c].ticket_quantity + ')', data.line_details[n].tickets_details[c].tickets_amount.toFixed(2) + ' EUR')
                }
            }
        }
        // PRIVREMENO SAKRIVENO — vidi napomenu kod PRODANIH KARATA.
        if(false && data.deacttive_line_detials && data.deacttive_line_detials.length > 0){
            printer.drawLine();
            printer.newLine();
            printer.alignCenter();
            printer.println("STORNIRANE KARTE")
            
            
            printer.alignLeft();
            printer.println('Linija: ');
            printer.leftRight('Kategorija (kol):', 'Iznos')
            for (let n = 0; n < data.deacttive_line_detials.length; n++) {
                printer.drawLine();
                printer.alignLeft();
                printer.println('('+ data.deacttive_line_detials[n].line_code +') - ' + data.deacttive_line_detials[n].line_name);
                printer.alignLeft();
                for (let c = 0; c < data.deacttive_line_detials[n].tickets_details.length; c++) {
                    printer.leftRight(data.deacttive_line_detials[n].tickets_details[c].category_name +'('+ data.deacttive_line_detials[n].tickets_details[c].ticket_quantity + ')', (data.deacttive_line_detials[n].tickets_details[c].tickets_amount * -1).toFixed(2)  + ' EUR')
                }
            }
        }
        // STORNO PO SREDSTVU PLAĆANJA — iznad sredstava plaćanja, kao i na
        // ekranu. "STORNIRANE KARTE" gore pokazuje ŠTO je vraćeno po linijama;
        // ovdje stoji KOLIKO je i kojim sredstvom izašlo iz blagajne, jer se to
        // pri primopredaji blagajne broji. Iznosi su pozitivni, već su uračunati
        // u UKUPNO na dnu.
        if(data.storno && data.storno.length > 0){
            printer.drawLine();
            printer.newLine();
            printer.alignCenter();
            // Naslov i stupci isti kao na mobilnoj.
            printer.println("STORNO")
            printer.alignLeft();
            printer.leftRight('Sredstvo plaćanja', 'Iznos')
            printer.drawLine();
            for (let n = 0; n < data.storno.length; n++) {
                printer.leftRight(
                    data.storno[n].payment_type_name + ' (' + data.storno[n].invoice_quantity + ')',
                    data.storno[n].amount.toFixed(2) + ' EUR'
                )
            }
            printer.drawLine();
            printer.bold(true);
            printer.leftRight('UKUPNO STORNIRANO:', (data.storno_amount || 0).toFixed(2) + ' EUR')
            printer.bold(false);
        }
        // STORNO S DRUGIH PRODAJNIH MJESTA — izdvojeno jer prihod od tih karata
        // nikad nije bio u ovoj blagajni, a novac iz nje izlazi. Bez toga
        // primopredaja pokazuje manjak koji se ne da objasniti iz prodaje.
        if (data.storno_external && data.storno_external.length > 0) {
            printer.drawLine();
            printer.newLine();
            printer.alignCenter();
            printer.println("STORNO S DRUGIH PRODAJNIH MJESTA")
            printer.alignLeft();
            printer.drawLine();
            for (let n = 0; n < data.storno_external.length; n++) {
                const redak = data.storno_external[n];
                printer.leftRight(
                    String(redak.channel || '—') + ' / ' + String(redak.ticket_code || ''),
                    Number(redak.amount || 0).toFixed(2) + ' EUR'
                )
            }
            printer.drawLine();
            printer.bold(true);
            printer.leftRight(
                'UKUPNO (' + (data.storno_external_count || 0) + '):',
                (data.storno_external_amount || 0).toFixed(2) + ' EUR'
            )
            printer.bold(false);
        }
        printer.drawLine();
        printer.newLine();
        //SREDSTVA PLAĆANJA
        printer.alignCenter();
        printer.println("SREDSTVA PLAĆANJA")
        printer.alignLeft();
        printer.leftRight('Sredstvo plaćanja', 'Iznos')
        printer.drawLine();
        for (let n = 0; n < data.shift_finance.length; n++) {
            printer.leftRight(data.shift_finance[n].payment_type_name, data.shift_finance[n].payment_amount.toFixed(2) + ' EUR')

        }
        
        // Razrada iznosa (broj računa, PDV osnovica, PDV, lučka pristojba) je
        // maknuta — mobilna je na ispisu nema, a zaključak se s njom razlikovao.
        // Podaci i dalje stoje u pregledu smjene na ekranu.
        printer.drawLine();
        printer.newLine();
        printer.bold(true);
        printer.setTextDoubleHeight();
        printer.drawLine();
        printer.leftRight('UKUPNO:', data.shift_sale.amount.toFixed(2) + ' EUR')
        printer.drawLine();
        // Vrijeme ispisa na dnu, kao na mobilnoj — po tome se razlikuje original
        // od naknadnog ispisa istog zaključka.
        printer.setTextNormal();
        printer.bold(false);
        printer.alignCenter();
        printer.println('Ispisano: ' + formatDatum(new Date()) + ' ' + formatVrijeme(new Date()));
        printer.alignLeft();
        cutOrFeed(printer, settingsData.printer_cut);


        printer.beep();

        return await runPrintJob(printer, 'SMJENA');

    }catch(error){
        console.log('PRINT SMJENA — greška pri pripremi ispisa:', error?.message || error)
        return false;
    }
}



module.exports = {
    shiftPrintHelper
}