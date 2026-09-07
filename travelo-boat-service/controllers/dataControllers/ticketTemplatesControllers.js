// Predložak PDF karte po prodajnom kanalu.
//
// Sama definicija predložaka živi u transactions servisu, koji ih i crta; ovdje
// se pamti samo koji je gdje izabran. Popis dostupnih predložaka portal dohvaća
// odande — da katalog i postavka ne budu na dva mjesta.

// Zadano kad kanal još nema zapis: postojeći predložak, bez sažetka. Novi kanal
// se time ponaša kao i prije nego su predlošci uvedeni.
const ZADANO = { template_key: "ticket_tamplate_1", summary_threshold: 0 };

const listTicketTemplatesController = async (req, res) => {
    const { TicketTemplatesModel } = req.app.locals.models;
    try {
        const redci = await TicketTemplatesModel.findAll({
            order: [["channel", "ASC"]],
            attributes: { exclude: ["createdAt", "updatedAt"] },
        });
        res.send({ status: 200, data: { templates: redci } });
    } catch (error) {
        console.log("listTicketTemplatesController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Jedan kanal. Ovo zove transactions servis pri svakom crtanju PDF-a, pa mora
// odgovoriti i kad zapisa nema — praznina je valjan odgovor, ne greška.
const getTicketTemplateController = async (req, res) => {
    const { TicketTemplatesModel } = req.app.locals.models;
    try {
        const red = await TicketTemplatesModel.findOne({
            where: { channel: String(req.params.channel || "").toUpperCase() },
            attributes: { exclude: ["createdAt", "updatedAt"] },
        });
        res.send({ status: 200, data: { template: red || { channel: req.params.channel, ...ZADANO } } });
    } catch (error) {
        console.log("getTicketTemplateController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

// Upsert po kanalu — jedan redak po kanalu, pa se postavka mijenja bez brisanja.
const upsertTicketTemplateController = async (req, res) => {
    const { TicketTemplatesModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const channel = String(data.channel || "").toUpperCase();
        if (!channel || !data.template_key) {
            return res.status(400).send({ status: 400, data: { message: "channel i template_key su obavezni" } });
        }
        // Prag ispod nule nema znacenje; nula znaci "nikad", pa se negativno
        // svodi na nju umjesto da se odbije.
        const prag = Math.max(0, Number(data.summary_threshold) || 0);

        const postojeci = await TicketTemplatesModel.findOne({ where: { channel } });
        if (postojeci) {
            await postojeci.update({ template_key: data.template_key, summary_threshold: prag });
        } else {
            await TicketTemplatesModel.create({ channel, template_key: data.template_key, summary_threshold: prag });
        }
        res.send({ status: 200, data: { message: "spremljeno" } });
    } catch (error) {
        console.log("upsertTicketTemplateController error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = {
    listTicketTemplatesController,
    getTicketTemplateController,
    upsertTicketTemplateController,
};
