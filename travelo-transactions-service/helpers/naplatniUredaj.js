const axios = require("axios");
const { getCoreServiceConfigData } = require("../controllers/configSyncController");

// Broj i naziv naplatnog uređaja po njegovom uuid-u.
//
// Uuid sam po sebi nikome ništa ne znači: u izvještaju, u Kontroli i u razgovoru
// s blagajnikom uređaj se zove svojim brojem (TID) ili nazivom. Zapisi su ga
// dosad nosili samo kao uuid, pa se svaki pregled morao naknadno spajati sa
// šifarnikom — ili se, češće, nije ni pokazivao.
//
// Popis je kratak i mijenja se rijetko (novi uređaj jednom u par mjeseci), pa
// se drži u memoriji. Neuspjeh se ne pamti: sljedeća prodaja mora smjeti
// pokušati ponovno, a dotad zapis ostaje samo s uuid-om — to je i dalje bolje
// nego da prodaja padne zbog šifarnika.
const TRAJANJE_MS = 10 * 60 * 1000;

let spremljeno = null;
let spremljenoU = 0;

const dohvatiUredaje = async () => {
    if (spremljeno && Date.now() - spremljenoU < TRAJANJE_MS) return spremljeno;
    const boUrl = getCoreServiceConfigData()?.services?.backoffice?.url;
    if (!boUrl) return spremljeno || [];
    const r = await axios.get(`${boUrl}/billing_devices`, { timeout: 10000, validateStatus: () => true });
    const popis = r.data?.data?.billing_devices || [];
    // Prazan popis znači da backoffice nije stvarno odgovorio — ne spremaj ga
    // preko valjanog.
    if (!popis.length) return spremljeno || [];
    spremljeno = popis;
    spremljenoU = Date.now();
    return popis;
};

// Vraća polja spremna za upis uz zapis. Prefiks se zadaje jer zapisi taj uređaj
// zovu različito (`billing_device_*` na karti, `terminal_*` u Kontroli), a
// značenje je isto.
const poljaUredaja = async (uuid, prefiks = "billing_device") => {
    const prazno = { [`${prefiks}_uuid`]: uuid || null, [`${prefiks}_tid`]: null, [`${prefiks}_name`]: null };
    if (!uuid) return prazno;
    try {
        const uredaj = (await dohvatiUredaje()).find((u) => u.uuid === uuid) || null;
        if (!uredaj) return prazno;
        return {
            [`${prefiks}_uuid`]: uuid,
            [`${prefiks}_tid`]: uredaj.tid || null,
            [`${prefiks}_name`]: uredaj.name || null,
        };
    } catch (e) {
        console.log("[naplatni-uredaj] sifarnik nije dostupan:", e?.message || e);
        return prazno;
    }
};

module.exports = { poljaUredaja, dohvatiUredaje };
