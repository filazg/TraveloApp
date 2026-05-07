const { getCompanyController, updateCompanyController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/companyServiceControllers")

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

const handleUpdateCompanyFeature = async(req,res)=>{
    try {
        await updateCompanyController(req.body)
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
        console.log('handleUpdateCompanyFeature error:', error?.message || error)
        res.status(500).send({ status:500, data:{ message: error?.message || 'update failed' } })
    }
}

module.exports = {
    handleGetCompanyFeature,
    handleUpdateCompanyFeature,
}
