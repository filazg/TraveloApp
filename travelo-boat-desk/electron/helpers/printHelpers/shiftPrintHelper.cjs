const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');
const { systemSettingsDataModel } = require('../../db/models/Settings.cjs');

const date = new Date()

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
        printer.println(data.shift.client_name);
        printer.println(data.shift.client_address);
        printer.println(data.shift.client_postal_code + ' ' + data.shift.client_town);
        printer.println(data.shift.client_country);
        printer.println(' OIB: ' + data.shift.client_oib);
        printer.drawLine();
        printer.println('POSLOVN PPROSTOR: ');
        printer.leftRight('Naziv:', data.shift.business_premise_name );
        printer.leftRight('Adresa:', data.shift.business_premise_address );
        printer.leftRight('Mjesto: ', data.shift.business_premise_postal_code + ' ' + data.shift.business_premise_postal_town);
        printer.leftRight('Oznaka poslovnice:', data.shift.business_premise_fiscal_mark );
        printer.leftRight('Oznaka blagajne:', data.shift.billing_device_fiscal_mark );
        printer.drawLine();
        printer.println('NAPOMENA: ');
        printer.alignLeft();
        printer.println(data.shift.remark || '');
        printer.drawLine();
        printer.bold(true);
        printer.alignCenter();
        printer.setTextDoubleHeight();
        printer.println("ZAKLJUČAK BR: "+ data.shift.id); 
        printer.setTextNormal();
        printer.alignLeft();
        printer.bold(false);
        printer.drawLine();
        printer.leftRight("Operater", data.shift.operater_name + ' ' + data.shift.operater_surname)
        printer.drawLine();
        printer.leftRight("Datum otvaranje smjene", data.shift.shift_start.toLocaleDateString("en-UK"))
        printer.leftRight("Vrijeme otvaranje smjene", data.shift.shift_start.toLocaleTimeString())
        printer.leftRight("Datum zatvaranja smjene", data.shift.shift_end.toLocaleDateString("en-UK"))
        printer.leftRight("Vrijeme zatvaranja smjene", data.shift.shift_end.toLocaleTimeString())
        printer.leftRight("Br. prvog računa", data.shift.shift_first_invoice)
        printer.leftRight("Br. zadnjeg računa", data.shift.shift_last_invoice)
        printer.drawLine();
        if(data.line_details && data.line_details.length > 0){
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
        if(data.deacttive_line_detials && data.deacttive_line_detials.length > 0){
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
        
        printer.drawLine();
        printer.newLine();
        printer.bold(true);
        printer.setTextDoubleHeight();
        printer.drawLine();
        printer.leftRight('UKUPNO:', data.shift_sale.amount.toFixed(2) + ' EUR')
        printer.drawLine();
        printer.cut();


        printer.beep();

        let execute = printer.execute()
        console.log("Print done!");

    }catch(error){
        console.log(error)
    }
}



module.exports = {
    shiftPrintHelper
}