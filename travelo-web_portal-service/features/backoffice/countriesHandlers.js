const {
    getCountriesController,
    addCountryController,
    updateCountryController,
} = require('../../controllers/coreServiceControllers/backofficeServiceControllers.js/countriesServiceControllers')

const handleGetCountriesFeature = async (req, res) => {
    try {
        const countriesData = await getCountriesController(req.query || {})
        res.send({
            status: 200,
            data: {
                path1: 'backofficeData',
                path2: 'countries',
                data: countriesData?.data?.countries || [],
            },
        })
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message })
    }
}

const handleAddCountryFeature = async (req, res) => {
    try {
        await addCountryController(req.body)
        const countriesData = await getCountriesController()
        res.send({
            status: 200,
            data: {
                path1: 'backofficeData',
                path2: 'countries',
                data: countriesData?.data?.countries || [],
            },
        })
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message })
    }
}

const handleUpdateCountryFeature = async (req, res) => {
    try {
        await updateCountryController(req.body)
        const countriesData = await getCountriesController()
        res.send({
            status: 200,
            data: {
                path1: 'backofficeData',
                path2: 'countries',
                data: countriesData?.data?.countries || [],
            },
        })
    } catch (error) {
        res.status(500).send({ status: 500, error: error.message })
    }
}

module.exports = {
    handleGetCountriesFeature,
    handleAddCountryFeature,
    handleUpdateCountryFeature,
}
