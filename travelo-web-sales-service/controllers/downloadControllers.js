const path = require('path')

// Upute koje izradjivac stranice dobiva s /web_page_documentations.
//
// Datoteka se mijenja sa svakim izdanjem uputa, pa naziv stoji ovdje na jednom
// mjestu; endpoint ostaje isti da se ne mijenja ono sto je vec dano vani.
const UPUTE = 'TraveloAPP-Web-Page-API-upute-1.1.pdf'

const downloadWebPageApiDocumentation = async (req, res) => {
    try {
        res.sendFile(path.join(__dirname, '../downloadDoc/', UPUTE))
    } catch (error) {
        console.log('ERROR', error)
        res.send({
            status: 500
        })
    }
}

module.exports = {
    downloadWebPageApiDocumentation
}
