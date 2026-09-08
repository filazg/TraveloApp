import api from '../api/client';
import { ENDPOINTS } from '../api/config';
import { loadPendingCopyPrints, markCopyPrintSynced, nextCopyNo, saveCopyPrint } from '../db/repo';
import { MAX_KOPIJA, postaviSuffixUQr, suffixKopije } from '../store/ticketCopyMark';

// Kopija karte dobiva svoja tri znaka ovdje, na uređaju. Račun oznake je poznat
// (redni broj kopije + marker iz uuid-a), pa poslužitelj za ispis nije potreban
// — terminal mora moći ispisati kopiju i bez mreže.
//
// Poslužitelj se o ispisu obavještava naknadno, kad veze bude; zapis do tada
// čeka u lokalnoj bazi kao i validacije.
export async function oznaciKopije(tickets, { basicData, operatorName } = {}) {
    if (!tickets?.length) {return tickets;}
    const trenutak = new Date().toISOString();

    const oznacene = [];
    for (const t of tickets) {
        try {
            const broj = await nextCopyNo(t.ticket_uuid);
            // Iznad dvadeset i četvrte kopije redni broj ne stane u dva znaka.
            // Ispis se svejedno bilježi — dogodio se, i to je podatak — samo mu
            // oznaka ne nosi broj.
            const suffix = broj <= MAX_KOPIJA ? suffixKopije(t.ticket_uuid, broj) : null;

            await saveCopyPrint({
                ticket_uuid: t.ticket_uuid,
                ticket_code: t.ticket_code || null,
                copy_no: broj,
                suffix,
                printed_at: trenutak,
                operator_name: operatorName || null,
                billing_device_uuid: basicData?.billing_device_uuid || null,
                billing_device_name: basicData?.billing_device_name || null,
                business_premise_name: basicData?.business_premise_name || null,
            });

            oznacene.push(suffix ? {
                ...t,
                ticket_code_suffix: suffix,
                // Oznaka stoji i u QR-u; inače bi se po samom kodu vidjelo koje
                // su karte kopije, a kontrola čita oboje.
                ticket_qr: postaviSuffixUQr(t.ticket_qr || t.ticket_uuid, suffix),
            } : t);
        } catch (e) {
            // Neuspjeh evidencije ne smije zaustaviti ispis: putnik čeka kartu.
            console.warn('[oznaciKopije] kopija ide bez nove oznake:', e?.message || e);
            oznacene.push(t);
        }
    }
    return oznacene;
}

// Prijava ispisanih kopija poslužitelju. Šalje se i redni broj — uređaj ga je
// već dodijelio i otisnuo na papir, pa ga poslužitelj zadržava umjesto da
// dodijeli svoj.
export async function posaljiKopije(limit = 200) {
    try {
        const red = await loadPendingCopyPrints(limit);
        if (!red.length) {return { poslano: 0 };}

        let poslano = 0;
        for (const k of red) {
            try {
                await api.post(ENDPOINTS.ticketCopyPrint, {
                    copies: [{
                        ticket_uuid: k.ticket_uuid,
                        ticket_code: k.ticket_code,
                        copy_no: k.copy_no,
                        // Oznaka je vec otisnuta na papiru; posluzitelj je
                        // zadrzava umjesto da racuna svoju.
                        suffix: k.suffix,
                        printed_at: k.printed_at,
                        operator_name: k.operator_name,
                        billing_device_uuid: k.billing_device_uuid,
                        billing_device_name: k.billing_device_name,
                        business_premise_name: k.business_premise_name,
                        origin: 'mobile',
                    }],
                }, { timeout: 10000 });
                await markCopyPrintSynced(k.id);
                poslano += 1;
            } catch (e) {
                const status = e?.response?.status;
                // Poslužitelj je odgovorio i odbio (npr. karta ne postoji):
                // ponavljanje nikad neće uspjeti, pa zapis ne ostaje zauvijek u
                // redu. Mrežna greška i 5xx se ponavljaju idući put.
                if (status && status !== 429 && status < 500) {
                    await markCopyPrintSynced(k.id);
                } else {
                    break;
                }
            }
        }
        return { poslano };
    } catch (e) {
        console.warn('[posaljiKopije] neuspjelo slanje:', e?.message || e);
        return { poslano: 0 };
    }
}
