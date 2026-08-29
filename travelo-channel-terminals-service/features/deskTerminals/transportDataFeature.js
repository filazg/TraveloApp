const crypto = require("crypto");
const { transportDataHandlers } = require("../../handlers/transportDataHandlers")

// Otisak paketa. Plovidbeni red se mijenja rijetko, a terminal ga osvježava često —
// pri prijavi, na zahtjev i pri promjeni dana. Bez ovoga svaki put ide nekoliko
// megabajta koje uređaj mora rasčlaniti i upisati u svoju bazu, iako su podaci
// isti. S otiskom uređaj pošalje ono što ima, a poslužitelj odgovori "nema
// promjene" u par bajtova.
const otisak = (podaci) => crypto
    .createHash("sha1")
    .update(JSON.stringify(podaci))
    .digest("hex")
    .slice(0, 16);

const handleGetTransportDataDeskTerminalsFeature = async (req,res)=>{
    try {
        // Uređaj se prepoznaje iz auth headera koji gateway ubaci u body
        // (isto kao basic_data). Bez njega se vraća nefiltrirano.
        const billingDeviceUuid = req.body?.header?.data?.t
        // `lean` traži mobilna: bez prošlih polazaka i bez polja koja ne koristi.
        // Blagajna ne šalje ništa i dobiva paket kakav je i dosad dobivala.
        const lean = String(req.query?.lean || '') === '1'
        const transportData = await transportDataHandlers(billingDeviceUuid, { lean })

        const verzija = otisak(transportData)
        if (req.query?.v && req.query.v === verzija) {
            return res.send({
                status: 200,
                data: { unchanged: true, version: verzija },
            })
        }

        res.send({
            status:200,
            data: { ...transportData, version: verzija }
        })
    } catch (error) {
         res.status(500).send({
            status:500,
            error:error.message
        })
    }
}

module.exports = {
    handleGetTransportDataDeskTerminalsFeature
}
