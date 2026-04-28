const { upsertTerminalShiftController, listShiftsController } = require("../../controllers/coreServiceControllers/transactionsServiceControllers")

// Upsert smjene s boat-deska — boat-desk je autoritet, backend pasivno sprema
// snapshot. Idempotentno po shift_uuid pa retry sa pending sync-a je siguran.
const handleUpsertTerminalShiftFeature = async (req, res) => {
    try {
        const data = req.body
        const result = await upsertTerminalShiftController(data)
        res.status(result.status === 500 ? 500 : 200).send({
            status: result.status,
            data: result.body?.data ?? null,
        })
    } catch (error) {
        console.log('handleUpsertTerminalShiftFeature error:', error?.message || error)
        res.status(500).send({ status: 500, error: error.message })
    }
}

const handleListShiftsFeature = async (req, res) => {
    try {
        const result = await listShiftsController(req.query || {})
        res.status(result.status === 500 ? 500 : 200).send(result.body)
    } catch (error) {
        console.log('handleListShiftsFeature error:', error?.message || error)
        res.status(500).send({ status: 500, error: error.message })
    }
}

module.exports = {
    handleUpsertTerminalShiftFeature,
    handleListShiftsFeature,
}
