const { podigniSignal } = require("./syncSignalsController");

// Validate (mark as boarded) a single ticket. Used by mobile gate scanner.
// Idempotent: re-validating an already-validated ticket returns the existing
// validate_data so the client can show "already used" without erroring.
const validateTicketController = async (req, res) => {
    const { TicketsModel } = req.app.locals.models;
    try {
        const body = req.body?.body || req.body || {};
        const { ticket_uuid, ticket_code, terminal_uuid, operator, validated_at } = body;

        if (!ticket_uuid && !ticket_code) {
            return res.status(400).json({ status: 400, data: { message: "ticket_uuid or ticket_code required" } });
        }

        const where = ticket_uuid ? { ticket_uuid } : { ticket_code };
        const ticket = await TicketsModel.findOne({ where });
        if (!ticket) {
            return res.status(404).json({ status: 404, data: { message: "Karta nije pronađena." } });
        }
        if (ticket.is_canceled) {
            return res.status(409).json({ status: 409, data: { message: "Karta je stornirana.", ticket } });
        }
        if (ticket.is_active === false) {
            return res.status(409).json({ status: 409, data: { message: "Karta nije aktivna.", ticket } });
        }
        if (ticket.status === "validated") {
            return res.status(200).json({
                status: 200,
                data: {
                    already_validated: true,
                    validate_data: ticket.validate_data,
                    ticket,
                    message: "Karta je već validirana.",
                },
            });
        }

        // Uredaj validira i bez mreze, pa javljanje zna stici satima kasnije. Tada
        // vrijedi vrijeme ukrcaja s uredaja, ne trenutak kad je mreza proradila —
        // inace izvjestaj pokazuje da su svi usli u isti tren.
        const sUredaja = validated_at ? new Date(validated_at) : null;
        const prihvatljivo = sUredaja
            && !Number.isNaN(sUredaja.getTime())
            && sUredaja <= new Date(Date.now() + 60 * 1000)
            && sUredaja > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const now = prihvatljivo ? sUredaja : new Date();
        await ticket.update({
            status: "validated",
            validate_data: now,
        });

        // Na istom polasku zna raditi vise uredaja: bez ovoga bi drugi jos drzao
        // kartu nevalidiranom i pustio istu osobu drugi put.
        try {
            await podigniSignal({
                SyncSignalsModel: req.app.locals.models.SyncSignalsModel,
                kind: "tickets",
                event: `validacija ${ticket.ticket_code || ticket.ticket_uuid}`,
            });
        } catch (e) {
            console.log("signal za validaciju nije zapisan:", e?.message || e);
        }

        return res.status(200).json({
            status: 200,
            data: {
                validated: true,
                validate_data: now,
                ticket,
            },
        });
    } catch (error) {
        console.log("validateTicketController error:", error?.message || error);
        return res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { validateTicketController };
