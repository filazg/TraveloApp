const { getHarborsController } = require("../../controllers/coreServiceControllers/salesServiceControllers")


const handleGetHarborsDataFeature = async(req,res)=>{
    try {
        const harborsData = await getHarborsController()
        let harborsToSend = []
        for(const newHarbor of harborsData.data.harbors){
            const harborToAdd = {
                harbor_name:newHarbor.name,
                harbor_code:newHarbor.code,
                harbor_longitude:newHarbor.longitude,
                harbor_latitude:newHarbor.latitude,
                harbor_region:newHarbor.region,
                harbor_country:newHarbor.country,
            }
            harborsToSend = [...harborsToSend, harborToAdd]
        }
        res.send({
            status:200,
            data:{
                harbors:harborsToSend
            }
        })
    } catch (error) {
        console.log(error)
        res.send({
            status:500
        })
    }
}

module.exports = {
    handleGetHarborsDataFeature
}