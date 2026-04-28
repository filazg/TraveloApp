const { searchTripsHandlers } = require("../../handlers/searchTripsHandlers")

const handleSearchTripsDataFeature = async(req,res)=>{
    try {
        const data = req.body
        const tripsData = await searchTripsHandlers(data)
        if(tripsData.status === 200){

        }else if(tripsData.status === 400){

        }else if(tripsData.status === 500){

        }else{
            
        }
    } catch (error) {
        
    }
}

module.exports = {
    handleSearchTripsDataFeature
}