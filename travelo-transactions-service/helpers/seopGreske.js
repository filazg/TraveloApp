const crypto = require("crypto");
const { getModels } = require("../dbModels");

// Upis „greške s povlaštenom karticom" — otočna karta izdana bez potvrđenog
// prava jer se iskaznica nije mogla očitati/provjeriti. Zove se iz prodajnih
// kontrolera (finalize_sale, add_invoices) za svaku kartu čiji `povlastica` blok
// nosi `greska.razlog`. Best-effort: neuspjeh upisa NE ruši prodaju.
//
// Razlog je obavezan (blagajna ga traži prije izdavanja); napomena je slobodna.
async function zabiljeziGreskuKartice(ticket, povlastica, ctx = {}) {
    const greska = povlastica?.greska;
    if (!greska?.razlog) return;
    try {
        const { SeopCardErrorModel } = getModels();
        await SeopCardErrorModel.create({
            uuid: crypto.randomUUID(),
            ticket_uuid: ticket.ticket_uuid || null,
            ticket_code: ticket.ticket_code || null,
            invoice_uuid: ticket.invoice_uuid || ctx.invoice_uuid || null,
            terminal_uuid: ctx.terminal_uuid || null,
            operator: ctx.operator || null,
            line_code: ticket.line_code || null,
            line_name: ticket.line_name || null,
            departure_harbor_id: ticket.departure_harbor_id || null,
            departure_harbor_name: ticket.departure_harbor_name || null,
            arrival_harbor_id: ticket.arrival_harbor_id || null,
            arrival_harbor_name: ticket.arrival_harbor_name || null,
            card_no: povlastica?.identifikator?.vrijednost || ticket.seop_card_no || null,
            id_type: povlastica?.identifikator?.vrsta || ticket.seop_id_vrsta || null,
            razlog: String(greska.razlog).trim(),
            napomena: greska.napomena ? String(greska.napomena).trim() : null,
            izdano_u: ctx.izdano_u || ticket.validate_data || null,
        });
    } catch (e) {
        console.log("[seop-greska] zapis nije uspio:", e?.message || e);
    }
}

module.exports = { zabiljeziGreskuKartice };
