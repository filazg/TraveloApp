const axios = require("axios");
const { getCoreServiceConfigData } = require("../configSyncController");

// One-shot admin-only backfill: fills invoice_business_premise_* and
// invoice_billing_device_* on historical invoices that have NULL billing
// device uuid. Picks the first BP that has a billing device (prefers type=WEB).
const backfillInvoicesFiscalController = async (req, res) => {
    const { InvoiceModel } = req.app.locals.models;
    try {
        const coreConfig = await getCoreServiceConfigData();
        const backofficeUrl = coreConfig?.services?.backoffice?.url;
        if (!backofficeUrl) {
            return res.status(500).json({ status: 500, data: { message: "backoffice URL missing" } });
        }

        const [bpResp, bdResp] = await Promise.all([
            axios.get(`${backofficeUrl}/business_premises`, { timeout: 5000, validateStatus: () => true }),
            axios.get(`${backofficeUrl}/billing_devices`, { timeout: 5000, validateStatus: () => true }),
        ]);
        const bps = bpResp.data?.data?.business_premises || [];
        const bds = bdResp.data?.data?.billing_devices || [];

        const bpsWithDevice = bps.filter((bp) => bds.some((bd) => bd.business_premise_uuid === bp.uuid));
        const bp =
            bpsWithDevice.find((b) => b.type === "WEB") ||
            bpsWithDevice[0] ||
            (bds.length ? bps.find((b) => b.uuid === bds[0].business_premise_uuid) : null) ||
            bps[0];
        const bd = bp ? bds.find((x) => x.business_premise_uuid === bp.uuid) : null;

        if (!bp || !bd) {
            return res.status(400).json({
                status: 400,
                data: { message: "no business_premise + billing_device pair found" },
            });
        }

        const companyResp = await axios.get(`${backofficeUrl}/company`, { timeout: 5000, validateStatus: () => true });
        const company = companyResp.data?.data?.company || {};

        const fields = {
            invoice_business_premise_uuid: bp.uuid,
            invoice_business_premise_name: bp.name,
            invoice_business_premise_fiscal_mark: bp.fiskal_mark || null,
            invoice_billing_device_uuid: bd.uuid,
            invoice_billing_device_fiscal_mark: bd.fiscal_mark || null,
            company_name: company.name || null,
            company_address: company.address || null,
            company_postal_code: company.postal_code || null,
            company_town: company.town || null,
            company_id: company.legal_id || null,
            company_vatid: company.vat_id || null,
            invoice_operator_name: "WEB PRODAJA",
        };

        // Only patch rows that are missing ANY of these fields.
        const { Op } = require("sequelize");
        const [affected] = await InvoiceModel.update(fields, {
            where: {
                [Op.or]: [
                    { invoice_billing_device_uuid: null },
                    { company_name: null },
                ],
            },
        });

        res.status(200).json({
            status: 200,
            data: {
                affected,
                applied: {
                    business_premise_uuid: bp.uuid,
                    business_premise_name: bp.name,
                    billing_device_uuid: bd.uuid,
                    billing_device_fiscal_mark: bd.fiscal_mark,
                },
            },
        });
    } catch (error) {
        console.log("backfillInvoicesFiscalController error:", error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { backfillInvoicesFiscalController };
