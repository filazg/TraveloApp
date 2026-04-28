

const redirectToWebSales = async(req,res)=>{
    try {
        
    } catch (error) {
        console.log('ERROR' , error)
        res.send({
            status:500             
        })
    }
}

module.exports = {
    redirectToWebSales
}