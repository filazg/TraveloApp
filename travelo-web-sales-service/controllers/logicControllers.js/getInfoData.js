

const getInfoData = (req,res)=>{
    try {
        res.send({
            informations:[]             
        }) 
    } catch (error) {
        console.log('ERROR' , error)
        res.send({
            status:500             
        })
    }
}

module.exports = {
    getInfoData
}