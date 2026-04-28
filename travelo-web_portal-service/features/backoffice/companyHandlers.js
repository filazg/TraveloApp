const { getCompanyController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/companyServiceControllers")

const handleGetCompanyFeature = async(req,res)=>{
    try {
        const companyData = await getCompanyController()
        res.send({
            status:200,
            data:{
                path1:'backofficeData',
                path2:'company',
                data:companyData.data.company
            }
        })
    } catch (error) {
        
    }
}
module.exports = {
    handleGetCompanyFeature
}