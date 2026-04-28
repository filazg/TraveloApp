const { addTerminalSaleController, getInvoiceDetailsController } = require("../../controllers/coreServiceControllers/transactionsServiceControllers")


const handleAddInvoiceDataDeskTerminalFeature = async(req,res)=>{
    try {
        const data = req.body
        const result = await addTerminalSaleController(data)
        // Backend vraća autoritativna fiskalna polja (invoice_no, invoice_fiskal_no,
        // invoice_code, fiskal_required) — proslijedi ih boat-desku da sinkronizira
        // lokalnu kopiju i printa s točnim brojem.
        res.status(result.status === 500 ? 500 : 200).send({
            status: result.status,
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