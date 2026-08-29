// Signali za osvjezavanje uredaja.
//
// Uredaj pita "je li se sto promijenilo" i dobiva par bajtova; cijeli paket
// povlaci tek kad se brojac pomakne. Pisu ovamo servisi koji rade promjene koje
// uredaj mora vidjeti odmah: storno karte (ovdje) te otkaz i pomak polaska
// (boat-service).

// Vrste su zatvoren popis: uredaj po njima zna sto osvjeziti, pa nepoznata
// vrsta znaci nesporazum, a ne novu funkciju.
const VRSTE = ["tickets", "transport"];

const podigniSignal = async ({ SyncSignalsModel, kind, event }) => {
    if (!VRSTE.includes(kind)) throw Object.assign(new Error(`nepoznata vrsta signala: ${kind}`), { status: 400 });
    const [red] = await SyncSignalsModel.findOrCreate({
        where: { kind },
        defaults: { kind, revision: 0, last_event: event || null },
    });
    await red.increment("revision");
    await red.update({ last_event: event || null });
    await red.reload();
    return { kind: red.kind, revision: red.revision, last_event: red.last_event, changed_at: red.updatedAt };
};

// Poziva ga servis koji je nesto promijenio. Namjerno ne prima uredaj ni
// partnera: signal je zajednicki, a tko ga treba odlucuje uredaj kad povuce
// podatke.
const bumpSyncSignalController = async (req, res) => {
    const { SyncSignalsModel } = req.app.locals.models;
    try {
        const { kind, event } = req.body || {};
        const podaci = await podigniSignal({ SyncSignalsModel, kind, event });
        res.send({ status: 200, data: podaci });
    } catch (error) {
        console.log("bumpSyncSignalController error:", error?.message || error);
        res.status(error.status || 500).json({ status: error.status || 500, data: { message: error.message } });
    }
};

// Cita ga kanal prema terminalima. Odgovor je namjerno malen — zove se cesto.
const getSyncSignalsController = async (req, res) => {
    const { SyncSignalsModel } = req.app.locals.models;
    try {
        const redci = await SyncSignalsModel.findAll({ attributes: ["kind", "revision", "updatedAt"] });
        const signals = {};
        for (const v of VRSTE) signals[v] = 0;
        for (const r of redci) signals[r.kind] = r.revision;
        res.send({ status: 200, data: { signals } });
    } catch (error) {
        console.log("getSyncSignalsController error:", error?.message || error);
        res.status(500).json({ status: 500, data: { message: error.message } });
    }
};

module.exports = { podigniSignal, bumpSyncSignalController, getSyncSignalsController, VRSTE };
