const { Op } = require("sequelize");
const { getSequelize } = require("../../config/database");
const { pomakni } = require("../../helpers/voyageTime");

// Stupci koje treba portalska POS prodaja. Ostalo (šifre voznog reda, oznake,
// smjer, zastavice) ondje se ne koristi, a vozni red je nekoliko tisuća redaka
// pa svaki stupac košta. Popis je fiksan namjerno — klijent ne bira stupce.
const POS_STUPCI = [
    "id", "uuid", "timetable_uuid", "departure_uuid", "sequence",
    "departure", "departure_date", "departure_time", "actual_departure",
    "arrival", "actual_arrival",
    "departure_harbor_order", "departure_harbor_id", "departure_harbor_name",
    "arrival_harbor_order", "arrival_harbor_id", "arrival_harbor_name",
    "line_code", "line_name", "sale_status",
];

const getRoutesDataController = async (req, res) => {
    const sequelize = getSequelize();
    const { RoutesModel } = req.app.locals.models;
    try {
        const result = await sequelize.transaction(async (t) => {
            // Ovo je izvor polazaka za blagajne (desk i mobilna preko
            // transport_data). Ni jedna ni druga ne filtriraju rute same, pa se
            // otkazani polazak filtrira ovdje — inače ostaje u prodaji na
            // blagajni iako je dispečer otkazao putovanje.
            // Neobavezni `from_date` (YYYY-MM-DD) odbacuje prošle polaske.
            // Bez njega se vraća sve, jer desk i mobilna kroz transport_data
            // očekuju cijeli vozni red — filtrira samo onaj tko to traži.
            // `departure_date` je tekst "DD/MM/YYYY", pa se uspoređuje preko
            // to_date, ne po abecedi.
            const odDatuma = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query?.from_date || ""))
                ? req.query.from_date
                : null;

            const routesData = await RoutesModel.findAll({
                where: {
                    is_active: true,
                    [Op.or]: [
                        { sale_status: { [Op.ne]: "CANCELED" } },
                        { sale_status: { [Op.is]: null } },
                    ],
                    ...(odDatuma ? {
                        [Op.and]: sequelize.literal(
                            `to_date(departure_date, 'DD/MM/YYYY') >= '${odDatuma}'::date`
                        ),
                    } : {}),
                },
                // `fields=pos` vraća samo ono što portalska prodaja koristi;
                // bez njega ide cijeli redak, jer desk i mobilna kroz
                // transport_data očekuju sve.
                attributes: req.query?.fields === "pos"
                    ? POS_STUPCI
                    : { exclude: ["createdAt", "updatedAt"] },
                order: [["id", "ASC"]],
            });
            res.send({ status: 200, data: { routes: routesData } });
        });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error } });
    }
};

// PATCH /routes/cancel_batch — body: { route_uuids: [], canceled: true|false }
//
// Ovo je kopija ruta za blagajne; matični zapis je u boat-serviceu i ondje se
// otkaz upisuje prvi. Ovdje se isti upis ponavlja da otkaz vrijedi odmah, bez
// čekanja na sinkronizaciju voznog reda.
//
// Uz sale_status gasi se i is_active jer terminali polaske filtriraju po njemu
// (mobilna: LineSelectScreen). Sam sale_status nitko na blagajni ne gleda, pa
// je otkazani polazak dosad ostajao u prodaji.
const cancelRoutesBatchController = async (req, res) => {
    const { RoutesModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const uuids = Array.isArray(data.route_uuids) ? data.route_uuids : [];
        const otkazan = data.canceled !== false;
        if (!uuids.length) {
            return res.send({ status: 400, data: { message: "route_uuids required" } });
        }
        const [affected] = await RoutesModel.update(
            otkazan
                ? { sale_status: "CANCELED", is_active: false }
                : { sale_status: null, is_active: true },
            { where: { uuid: { [Op.in]: uuids } } }
        );
        res.send({ status: 200, data: { affected, canceled: otkazan } });
    } catch (error) {
        console.log("cancelRoutesBatchController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};


// PATCH /routes/reschedule_batch — body: { route_uuids: [], delta_minutes }
//
// Pomak polaska. Planirano vrijeme ostaje netaknuto; aktualno se racuna kao
// planirano + razlika, pa je operacija idempotentna, a delta_minutes = 0 vraca
// polazak na vozni red. Razliku racuna boat-service (maticni podaci) i salje je
// ovamo, da isti racun ne postoji na tri mjesta.
const rescheduleRoutesBatchController = async (req, res) => {
    const { RoutesModel } = req.app.locals.models;
    try {
        const data = req.body?.body || req.body || {};
        const uuids = Array.isArray(data.route_uuids) ? data.route_uuids : [];
        const delta = Number(data.delta_minutes) || 0;
        if (!uuids.length) {
            return res.send({ status: 400, data: { message: "route_uuids required" } });
        }
        const rute = await RoutesModel.findAll({ where: { uuid: uuids } });
        for (const r of rute) {
            await r.update({
                actual_departure: pomakni(r.departure, delta),
                actual_arrival: pomakni(r.arrival, delta),
            });
        }
        res.send({ status: 200, data: { affected: rute.length, delta_minutes: delta } });
    } catch (error) {
        console.log("rescheduleRoutesBatchController error:", error?.message || error);
        res.send({ status: 500, data: { error: error.message } });
    }
};

module.exports = {
    getRoutesDataController,
    cancelRoutesBatchController,
    rescheduleRoutesBatchController,
};
