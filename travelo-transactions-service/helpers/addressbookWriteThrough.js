const axios = require("axios");
const { getCoreServiceConfigData } = require("../controllers/configSyncController");

// Write-through u centralni adresar: kad se izda račun s kupcem koji ima OIB
// (R1/F2), taj se kupac automatski upiše u backoffice adresar, da adresar
// bude jedinstven kroz cijeli sustav.
//
// Fire-and-forget: NE smije rušiti niti usporavati izdavanje računa. Backoffice
// endpoint je idempotentan po OIB-u (popuni prazna polja, ne gazi postojeća),
// pa se ovaj poziv smije ponoviti bez štete.
//
// invoice: objekt s buyer_* poljima iz transactions invoice modela.
async function upsertKupcaUAdresar(invoice) {
    try {
        if (!invoice) return;
        const oib = invoice.buyer_oib;
        // Fizičke osobe bez OIB-a se ne upisuju.
        if (!oib) return;

        const coreConfig = await getCoreServiceConfigData();
        const backofficeUrl = coreConfig?.services?.backoffice?.url;
        if (!backofficeUrl) {
            console.log("addressbookWriteThrough: backoffice URL missing in core config — preskačem upis");
            return;
        }

        const body = {
            body: {
                buyer_vat_id: oib,
                buyer_name: invoice.buyer_name,
                buyer_company_name: invoice.buyer_company_name,
                buyer_address: invoice.buyer_address,
                buyer_town: invoice.buyer_town,
                buyer_postal_code: invoice.buyer_postal_code,
                buyer_country: invoice.buyer_country,
                buyer_email: invoice.buyer_email,
                buyer_tel: invoice.buyer_tel,
            },
        };

        await axios.post(`${backofficeUrl}/addressbook/upsert`, body, {
            timeout: 10000,
            validateStatus: () => true,
        });
    } catch (error) {
        console.log("addressbookWriteThrough error:", error?.message || error);
    }
}

module.exports = { upsertKupcaUAdresar };
