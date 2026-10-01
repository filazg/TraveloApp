const axios = require('axios');
const { getCoreServiceConfigData } = require('../configServices/configSyncController');

// Dodatne karte po vrsti karte (npr. Redovna → dojenče) za uređaje.
//
// Vrste karata žive u boat servisu i uređaji ih inače ne dobivaju — znaju ih
// samo kroz retke cjenika. Dodatna vrsta pak u cjeniku relacije ne mora
// postojati (prodaje se bez naplate), pa uređaj uz vezu dobiva i njezin naziv
// i SEOP namjenu. Neuspjeh vraća prazan popis — uređaj tada samo ne nudi
// dodatne karte, a ostatak osnovnih podataka stiže normalno.
const getTicketTypeExtrasController = async () => {
    try {
        const boatUrl = getCoreServiceConfigData()?.services?.boat?.url;
        if (!boatUrl) return [];
        const r = await axios.get(boatUrl + '/tickets_types', { timeout: 8000, validateStatus: () => true });
        const vrste = r.data?.data?.ticketTypes || [];
        const poUuid = new Map(vrste.map((t) => [t.uuid, t]));
        const out = [];
        for (const t of vrste) {
            if (t.is_active === false || !Array.isArray(t.extra_tickets)) continue;
            for (const d of t.extra_tickets) {
                const dodatna = poUuid.get(d.ticket_type_uuid);
                if (!dodatna || dodatna.is_active === false) continue;
                out.push({
                    parent_ticket_type_uuid: t.uuid,
                    ticket_type_uuid: dodatna.uuid,
                    ticket_type_name: dodatna.name,
                    seop_type: dodatna.seop_type || null,
                    max_qty: Number(d.max_qty) || 1,
                });
            }
        }
        return out;
    } catch (error) {
        console.log('getTicketTypeExtrasController error:', error?.message || error);
        return [];
    }
};

module.exports = { getTicketTypeExtrasController };
