const path = require('path')

const downloadWebPageApiDocumentation = async(req,res)=>{
    try {
        res.sendFile(path.join(__dirname, '../downloadDoc/'+'travelo_partner_web_page_api_v1.0.pdf'))
    } catch (error) {
        console.log(error)
        console.log('ERROR' , error)
        res.send({
            status:500             
        })
    }
}

module.exports = {
    downloadWebPageApiDocumentation
}