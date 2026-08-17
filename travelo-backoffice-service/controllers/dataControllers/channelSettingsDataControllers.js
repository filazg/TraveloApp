// Kanali za koje se vode postavke izdavanja računa.
const CHANNELS = ["web", "partner"];

const isValidChannel = (c) => CHANNELS.includes(String(c || "").toLowerCase());

// Redak po kanalu uvijek postoji prema van — ako ga nema u bazi, vrati prazan
// predložak da portal ne mora razlikovati "još nije postavljeno" od greške.
const emptySettings = (channel) => ({
    channel,
    business_premise_uuid: null,
    business_premise_name: null,
    billing_device_uuid: null,
    billing_device_fiscal_mark: null,
    payment_method_uuid: null,
    payment_method_name: null,
    fiskal_required: false,
    invoice_language: "hr",
    invoice_header: null,
    invoice_footer: null,
    cost_center: null,
    is_active: false,
});

const getChannelSettingsDataController = async (req, res) => {
    const { ChannelSettingsModel } = req.app.locals.models;
    try {
        const rows = await ChannelSettingsModel.findAll({
            attributes: { exclude: ["createdAt", "updatedAt"] },
            order: [["channel", "ASC"]],
        });
        const byChannel = new Map(rows.map((r) => [r.channel, r.toJSON()]));
        const channel_settings = CHANNELS.map((c) => byChannel.get(c) || emptySettings(c));
        res.send({ status: 200, data: { channel_settings } });
    } catch (error) {
        console.log("getChannelSettingsDataController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

const getChannelSettingDataController = async (req, res) => {
    const { ChannelSettingsModel } = req.app.locals.models;
    try {
        const channel = String(req.params.channel || "").toLowerCase();
        if (!isValidChannel(channel)) {
            return res.send({ status: 400, data: { error: `Nepoznat kanal "${req.params.channel}"` } });
        }
        const row = await ChannelSettingsModel.findOne({
            where: { channel },
            attributes: { exclude: ["createdAt", "updatedAt"] },
        });
        res.send({ status: 200, data: { channel_settings: row ? row.toJSON() : emptySettings(channel) } });
    } catch (error) {
        console.log("getChannelSettingDataController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

// Upsert — kartica šalje cijeli set postavki kanala.
const upsertChannelSettingDataController = async (req, res) => {
    const { ChannelSettingsModel } = req.app.locals.models;
    try {
        const data = req.body.body || req.body;
        const channel = String(req.params.channel || data.channel || "").toLowerCase();
        if (!isValidChannel(channel)) {
            return res.send({ status: 400, data: { error: `Nepoznat kanal "${channel}"` } });
        }

        const values = {
            business_premise_uuid: data.business_premise_uuid || null,
            business_premise_name: data.business_premise_name || null,
            billing_device_uuid: data.billing_device_uuid || null,
            billing_device_fiscal_mark: data.billing_device_fiscal_mark || null,
            payment_method_uuid: data.payment_method_uuid || null,
            payment_method_name: data.payment_method_name || null,
            fiskal_required: data.fiskal_required === true || data.fiskal_required === "true",
            invoice_language: data.invoice_language || "hr",
            invoice_header: data.invoice_header || null,
            invoice_footer: data.invoice_footer || null,
            cost_center: data.cost_center || null,
            is_active: data.is_active !== false && data.is_active !== "false",
        };

        const existing = await ChannelSettingsModel.findOne({ where: { channel } });
        if (existing) {
            await existing.update(values);
        } else {
            await ChannelSettingsModel.create({ channel, ...values });
        }

        const row = await ChannelSettingsModel.findOne({
            where: { channel },
            attributes: { exclude: ["createdAt", "updatedAt"] },
        });
        res.send({ status: 200, data: { channel_settings: row.toJSON() } });
    } catch (error) {
        console.log("upsertChannelSettingDataController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

module.exports = {
    CHANNELS,
    getChannelSettingsDataController,
    getChannelSettingDataController,
    upsertChannelSettingDataController,
};
