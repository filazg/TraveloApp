const { addTerminalSaleController, getInvoiceDetailsController } = require("../../controllers/coreServiceControllers/transactionsServiceControllers")


const handleAddInvoiceDataDeskTerminalFeature = async(req,res)=>{
    try {
        const data = req.body
        const result = await addTerminalSaleController(data)
        // Transactions servis greške vraća kao HTTP 200 s {status:500} u tijelu.
        // Ako gledamo samo HTTP status, terminalu javimo uspjeh iako upis nije
        // prošao — on račun označi kao poslan i više ga ne pokušava, pa podatak
        // tiho ostane samo na blagajni. Mjerodavan je status iz tijela.
        const bodyStatus = Number(result.body?.status)
        const effective = Number.isFinite(bodyStatus) ? bodyStatus : result.status
        if (effective >= 400) {
            console.log('add_invoices odbijen:', effective, JSON.stringify(result.body?.data || {}).slice(0, 500))
        }
        res.status(effective >= 400 ? effective : 200).send({
            status: effective,
            data: result.body?.data ?? null,
        })
    } catch (error) {
        res.status(500).send({
            status:500,
            error:error.message
        })
    }
}

// GET — boat-desk koristi ovo da povuče autoritativni F2 (YesCor) status
// za pojedini račun (yescor_status, yescor_fiscalization_status, yescor_document_id, …).
const handleGetInvoiceStatusFeature = async (req, res) => {
    try {
        const invoiceUuid = req.params.invoice_uuid
        const { status, body } = await getInvoiceDetailsController(invoiceUuid)
        res.status(status).send(body)
    } catch (error) {
        console.log('handleGetInvoiceStatusFeature error:', error?.message || error)
        res.status(500).send({ status: 500, data: { message: error.message } })
    }
}

module.exports = {
    handleAddInvoiceDataDeskTerminalFeature,
    handleGetInvoiceStatusFeature,
}