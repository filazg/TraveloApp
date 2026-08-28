const { listVoyageTicketsController } = require("../../controllers/coreServiceControllers/transactionsServiceControllers");
const { getBusinessPremisesController } = require("../../controllers/coreServiceControllers/backofficeServiceControllers");

// Blagajna smije stornirati kartu prodanu na drugom prodajnom mjestu, ali samo
// ako je to poslovnica ili pokretna blagajna. Uredske i web prodaje imaju svoj
// put povrata (platni nalozi), a partnerske karte se ne naplaćuju putniku pa
// nemaju ni što vratiti.
const DOZVOLJENI_TIPOVI = ["POSL", "MOBIL"];

const nazivTipa = (tip) => {
    if (tip === "POSL") return "poslovnica";
    if (tip === "MOBIL") return "pokretna blagajna";
    if (tip === "URED") return "ured";
    if (tip === "WEB_OFFICE") return "web prodaja";
    return tip || "nepoznato";
};

// GET /terminal/external_ticket?ticket_code=XXXX
// Vraća kartu s podacima o prodajnom mjestu na kojem je izdana i ocjenom smije
// li se stornirati na blagajni. Ocjena je ovdje, a ne na blagajni, da pravilo
// stoji na jednom mjestu za sve terminale.
const handleExternalTicketFeature = async (req, res) => {
    try {
        const oznaka = String(req.query?.ticket_code || "").trim();
        if (!oznaka) {
            return res.status(400).send({ status: 400, data: { message: "ticket_code je obavezan" } });
        }

        const { status, body } = await listVoyageTicketsController({ ticket_code: oznaka, limit: 1 });
        if (status !== 200) {
            return res.status(status).send(body);
        }
        const karte = body?.data?.tickets || body?.tickets || [];
        const karta = karte[0];
        if (!karta) {
            return res.send({ status: 200, data: { found: false, message: "Karta s tom oznakom ne postoji." } });
        }

        // Tip prodajnog mjesta ne stoji na karti nego u šifarniku poslovnih
        // prostora, pa se dohvaća i uparuje po uuid-u.
        let prostor = null;
        try {
            const prostori = await getBusinessPremisesController();
            const lista = prostori?.data?.business_premises || [];
            prostor = lista.find((p) => p.uuid === karta.business_premise_uuid) || null;
        } catch (error) {
            console.log("[external_ticket] šifarnik poslovnih prostora nije dostupan:", error?.message || error);
            return res.status(503).send({
                status: 503,
                data: { message: "Podaci o prodajnim mjestima nisu dostupni — storno nije moguć." },
            });
        }

        const tip = prostor?.type || "";
        const dozvoljeno = DOZVOLJENI_TIPOVI.includes(tip);
        const vecStornirana = Boolean(karta.is_canceled) || String(karta.status || "").toUpperCase() === "CANCELED";

        return res.send({
            status: 200,
            data: {
                found: true,
                ticket: karta,
                business_premise: {
                    uuid: karta.business_premise_uuid || prostor?.uuid || "",
                    name: karta.business_premise_name || prostor?.name || "",
                    type: tip,
                    type_name: nazivTipa(tip),
                },
                allowed: dozvoljeno && !vecStornirana,
                reason: !prostor
                    ? "Prodajno mjesto karte nije poznato."
                    : !dozvoljeno
                        ? `Karta je izdana na prodajnom mjestu tipa ${nazivTipa(tip)} — na blagajni se može stornirati samo karta poslovnice ili pokretne blagajne.`
                        : vecStornirana
                            ? "Karta je već stornirana."
                            : "",
            },
        });
    } catch (error) {
        console.log("handleExternalTicketFeature error:", error?.message || error);
        res.status(500).send({ status: 500, data: { message: error.message } });
    }
};

module.exports = { handleExternalTicketFeature };
