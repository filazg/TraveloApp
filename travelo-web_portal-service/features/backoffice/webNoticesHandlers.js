const { getWebNoticesController, addWebNoticeController, updateWebNoticeController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/webNoticesControllers")

// Obavijesti se drze uz podatke boat modula jer se ondje i uredjuju, iako ih
// cuva backoffice — administrator ih vidi na jednom mjestu s ostalim podacima
// koje objavljuje prema van.
const posalji = (res, data) => {
    res.send({
        status: 200,
        data: {
            path1: 'boatData',
            path2: 'web_notices',
            data
        }
    })
}

const handleGetWebNoticesFeature = async (req, res) => {
    try {
        const noticesData = await getWebNoticesController()
        posalji(res, noticesData.data.web_notices)
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message })
    }
}

const handleAddWebNoticeFeature = async (req, res) => {
    try {
        await addWebNoticeController(req.body)
        const noticesData = await getWebNoticesController()
        posalji(res, noticesData.data.web_notices)
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message })
    }
}

const handleUpdateWebNoticeFeature = async (req, res) => {
    try {
        await updateWebNoticeController(req.body)
        const noticesData = await getWebNoticesController()
        posalji(res, noticesData.data.web_notices)
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message })
    }
}

module.exports = {
    handleGetWebNoticesFeature,
    handleAddWebNoticeFeature,
    handleUpdateWebNoticeFeature
}
