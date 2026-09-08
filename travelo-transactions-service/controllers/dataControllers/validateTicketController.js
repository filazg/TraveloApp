const { podigniSignal } = require("./syncSignalsController");
const { procitajSuffix, suffixIzQr } = require("../../helpers/ticketCopyMark");
const { VRSTE } = require("../../helpers/ticketControlTypes");

// Sto je skener procitao. QR nosi uuid i jos sest polja, a sufiks je osmo; s
// papira se zna prepisati i sam broj karte, gdje sufiks stoji iza razmaka.
// Posalje li klijent sufiks izrijekom, vjeruje se njemu.
const procitajSkenirano = (body) => {
    if (body.suffix) return String(body.suffix).trim().toUpperCase();
    const scanned = String(body.scanned || "").trim();
    if (!scanned) return null;
    const izQr = suffixIzQr(scanned);
    if (izQr) return izQr.trim().toUpperCase();
    const m = /\s([0-9A-Fa-f]{3})$/.exec(scanned);
    return m ? m[1].toUpperCase() : null;
};

// Validate (mark as boarded) a single ticket. Used by mobile gate scanner.
// Idempotent: re-validating an already-validated ticket returns the existing
// validate_data so the client can show "already used" without erroring.
//
// Svaki pokusaj se biljezi u ticket_validations — i onaj koji ne prode. Drugi
// pokusaj s kopijom je upravo onaj koji ne uspije, pa bi bez toga ispao
// nevidljiv, a on je razlog zbog kojeg evidencija postoji.
const validateTicketController = async (req, res) => {
    const { TicketsModel, TicketValidationModel } = req.app.locals.models;
    const body = req.body?.body || req.body || {};
    const { ticket_uuid, ticket_code, terminal_uuid, validated_at, route_uuid, other_voyage } = body;

    // Operater dolazi kao ime, ali starije mobilne salju cijeli objekt
    // {uuid, name}. Takav zapis Sequelize odbija, pa je do sada svaki pokusaj
    // validacije s mobilne ispadao neevidentiran — validacija bi prosla, a u
    // kontroli ne bi ostalo nista.
    const operator = typeof body.operator === "object" && body.operator !== null
        ? (body.operator.name || body.operator.uuid || null)
        : (body.operator || null);
    const suffix = procitajSkenirano(body);

    // Zapis pokusaja. Ne baca: neuspjelo biljezenje ne smije srusiti validaciju —
    // putnik stoji na ukrcaju.
    const zabiljezi = async ({ ticket, outcome, is_conflict = false, conflict_reason = null, conflict_type = null, kada }) => {
        try {
            const uuidZaCitanje = ticket?.ticket_uuid || ticket_uuid;
            const citanje = uuidZaCitanje ? procitajSuffix(uuidZaCitanje, suffix) : null;
            await TicketValidationModel.create({
                ticket_uuid: uuidZaCitanje || null,
                ticket_code: ticket?.ticket_code || ticket_code || null,
                scanned: body.scanned || null,
                suffix: suffix || null,
                is_copy: citanje ? citanje.isCopy : null,
                copy_no: citanje?.copyNo ?? null,
                outcome,
                is_conflict,
                conflict_reason,
                conflict_type,
                terminal_uuid: terminal_uuid || null,
                operator: operator || null,
                // Polazak s kojeg je ocitano salje uredaj: posluzitelj zna kojoj
                // voznji karta pripada, ali ne i gdje je covjek stajao.
                validated_route_uuid: route_uuid || null,
                other_voyage: !!other_voyage,
                validated_at: kada || new Date(),
            });
        } catch (e) {
            console.log("zapis validacije nije spremljen:", e?.message || e);
        }
    };

    try {
        if (!ticket_uuid && !ticket_code) {
            return res.status(400).json({ status: 400, data: { message: "ticket_uuid or ticket_code required" } });
        }

        const where = ticket_uuid ? { ticket_uuid } : { ticket_code };
        const ticket = await TicketsModel.findOne({ where });
        if (!ticket) {
            await zabiljezi({ ticket: null, outcome: "not_found" });
            return res.status(404).json({ status: 404, data: { message: "Karta nije pronađena." } });
        }
        if (ticket.is_canceled) {
            // Stornirana karta na ukrcaju nije samo neuspjeh nego pokusaj — netko
            // se ukrcava kartom koja je ponistena, cesto uz vec vracen novac.
            await zabiljezi({
                ticket,
                outcome: "canceled",
                is_conflict: true,
                conflict_type: VRSTE.CANCELED_TICKET,
                conflict_reason: "pokušaj ukrcaja storniranom kartom",
            });
            return res.status(409).json({ status: 409, data: { message: "Karta je stornirana.", ticket } });
        }
        if (ticket.is_active === false) {
            await zabiljezi({ ticket, outcome: "inactive" });
            return res.status(409).json({ status: 409, data: { message: "Karta nije aktivna.", ticket } });
        }
        if (ticket.status === "validated") {
            // Karta je vec prosla, pa je svako sljedece ocitanje sukob. Vrsta se
            // odreduje usporedbom s otiskom koji je prosao prvi put.
            //
            // I isti otisak ponovno je sukob, namjerno: fotografija QR-a nosi
            // istu oznaku kao original, pa je ponovno ocitanje jedini trag koji
            // uopce postoji. Putnik koji dvaput prisloni kartu time upada u
            // popis, ali lazna uzbuna je jeftinija od propustene.
            const prva = await TicketValidationModel.findOne({
                where: { ticket_uuid: ticket.ticket_uuid, outcome: "validated" },
                order: [["validated_at", "ASC"]],
            });
            const sada = procitajSuffix(ticket.ticket_uuid, suffix);
            const prijeKopija = !!prva?.is_copy;
            const sadaKopija = !!sada?.isCopy;

            // Razlog je opis slucaja, bez rednih brojeva kopija. Koja je tocno
            // kopija prosla a koja nije vidi se u povijesti karte, gdje uz svaki
            // pokusaj stoji i otisak; u popisu bi brojevi samo zatrpali redak.
            let vrsta = VRSTE.SAME_ARTIFACT;
            let razlog = "isti otisak očitan ponovno";
            if (prva && sada) {
                if (prijeKopija !== sadaKopija) {
                    vrsta = sadaKopija ? VRSTE.COPY_OVER_ORIGINAL : VRSTE.ORIGINAL_OVER_COPY;
                    razlog = sadaKopija
                        ? "kopija preko validiranog originala"
                        : "original preko validirane kopije";
                } else if (sadaKopija && (prva.copy_no ?? null) !== (sada.copyNo ?? null)) {
                    vrsta = VRSTE.COPY_OVER_COPY;
                    razlog = "druga kopija preko validirane kopije";
                }
            }

            await zabiljezi({
                ticket,
                outcome: "already_validated",
                is_conflict: true,
                conflict_type: vrsta,
                conflict_reason: razlog,
            });
            return res.status(200).json({
                status: 200,
                data: {
                    already_validated: true,
                    validate_data: ticket.validate_data,
                    ticket,
                    is_conflict: true,
                    conflict_type: vrsta,
                    conflict_reason: razlog,
                    message: `Karta je već validirana — ${razlog}.`,
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

        await zabiljezi({ ticket, outcome: "validated", kada: now });

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
        await zabiljezi({ ticket: null, outcome: "error" });
        return res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { validateTicketController };
