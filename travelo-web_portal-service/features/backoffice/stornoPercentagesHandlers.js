const {
    getStornoPercentagesController,
    addStornoPercentageController,
    updateStornoPercentageController,
} = require("../../controllers/coreServiceControllers/backofficeServiceControllers.js/stornoPercentagesControllers")

// Nakon svake izmjene vraća se svježa lista, da grid u portalu ne treba zasebni
// refresh — isti obrazac kao ostali šifarnici u administraciji.
const respondWithList = async (res) => {
    const data = await getStornoPercentagesController()
    res.send({
        status: 200,
        data: {
            path1: 'backofficeData',
            path2: 'storno_percentages',
            data: data?.data?.storno_percentages || [],
        }
    })
}

const handleGetStornoPercentagesFeature = async (req, res) => {
    try {
        await respondWithList(res)
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message })
    }
}

const handleAddStornoPercentageFeature = async (req, res) => {
    try {
        const result = await addStornoPercentageController(req.body)
        // Backoffice odbija duplikat i nevaljan postotak — poruku treba proslijediti
        // korisniku, inače bi grid samo tiho ostao isti.
        if (result && result.status && result.status >= 400) {
            return res.send({ status: result.status, error: result?.data?.message || 'Spremanje nije uspjelo' })
        }
        await respondWithList(res)
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message })
    }
}

const handleUpdateStornoPercentageFeature = async (req, res) => {
    try {
        const result = await updateStornoPercentageController(req.body)
        if (result && result.status && result.status >= 400) {
            return res.send({ status: result.status, error: result?.data?.message || 'Ažuriranje nije uspjelo' })
        }
        await respondWithList(res)
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message })
    }
}

module.exports = {
    handleGetStornoPercentagesFeature,
    handleAddStornoPercentageFeature,
    handleUpdateStornoPercentageFeature,
}
