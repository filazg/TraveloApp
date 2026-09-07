import api from '../api/client';
import { ENDPOINTS } from '../api/config';
import { deletePendingAttempt, loadPendingAttempts, savePendingAttempt } from '../db/repo';

// Prijava jednog očitanja karte.
//
// Prijavljuje se SVAKO očitanje, i ono koje uređaj sam odbije: drugo očitanje
// iste karte i pokušaj ukrcaja storniranom kartom su upravo ono što kontrola
// treba vidjeti. Bez toga u portalu ostane samo prvi, uspješni prolaz.
//
// Zapis prvo ide u red pa se šalje u pozadini — djelatnik na vratima ne smije
// čekati mrežu, a bez mreže prijava odlazi pri sljedećoj sinkronizaciji.
export async function prijaviPokusaj({ ticketUuid, scanned, kada, terminalUuid, operator, outcome }) {
    if (!ticketUuid) {return false;}
    const vrijeme = kada || new Date().toISOString();
    // Poslužitelj operatera zapisuje kao tekst; objekt bi mu srušio zapis.
    const imeOperatera = typeof operator === 'object' && operator !== null
        ? (operator.name || operator.uuid || '')
        : (operator || '');

    try {
        await savePendingAttempt({
            ticketUuid,
            scanned,
            validatedAt: vrijeme,
            terminalUuid,
            operator: imeOperatera,
            outcome,
        });
    } catch (e) {
        console.log('[prijaviPokusaj] red neposlanih nije zapisan:', e?.message || e);
    }

    try {
        api.post(
            ENDPOINTS.validateTicket,
            {
                ticket_uuid: ticketUuid,
                // Otisak s papira: poslužitelj iz njega čita oznaku i po njoj
                // razlikuje kopiju od originala.
                scanned: scanned || undefined,
                terminal_uuid: terminalUuid,
                operator: imeOperatera,
                validated_at: vrijeme,
            },
            { timeout: 8000 },
        )
            .then(() => makniIzReda(ticketUuid, vrijeme))
            .catch((e) => console.log('[prijaviPokusaj] slanje nije prošlo, ostaje u redu:', e?.message || e));
    } catch (e) {
        console.log('[prijaviPokusaj] POST error:', e?.message || e);
    }
    return true;
}

// Zapis se iz reda miče po paru (karta, vrijeme) — istom kojim je i upisan.
async function makniIzReda(ticketUuid, kada) {
    try {
        const red = await loadPendingAttempts(500);
        const nas = red.find((v) => v.ticket_uuid === ticketUuid && v.validated_at === kada);
        if (nas) {await deletePendingAttempt(nas.id);}
    } catch (e) {
        console.log('[prijaviPokusaj] brisanje iz reda nije uspjelo:', e?.message || e);
    }
}
