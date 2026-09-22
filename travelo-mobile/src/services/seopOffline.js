// Odluka o SEOP popustu kad poslužitelj nije odgovorio.
//
// Online odluku donosi poslužitelj; ovo je jedini slučaj u kojem je terminal
// donosi sam, i to samo zato što bez mreže nema koga pitati. Sve što mu za to
// treba došlo je sinkronizacijom: šifarnik popusta po pravu (basic_data),
// postavke linije i SEOP-otoci luka (transport_data). Čip daje šifru prava i
// otok — ništa se ne nagađa.
//
// Isti propis i isti redoslijed provjera kao u blagajni
// (travelo-boat-desk/renderer/src/components/sales/subsidisedHelpers.js); dvije
// aplikacije ne smiju istu karticu naplatiti različito.
//
// Vraća `{ popust_postotak, primijenjen, razlog }`. Kad popusta nema, razlog
// kaže zašto — operater na ekranu mora vidjeti je li riječ o pravilu linije, o
// nepostavljenom popustu ili o kartici s krivog otoka.
export const popustBezMreze = ({
    popusti = [],
    pravo = null,
    otokKartice = null,
    linija = null,
    luke = [],
} = {}) => {
    const ne = (razlog) => ({ popust_postotak: 0, primijenjen: false, razlog });

    if (!linija || linija.seop_mode === 'ne') {
        return ne('Na ovoj liniji otočne iskaznice se ne priznaju.');
    }
    // Kad linija ne primjenjuje SEOP popust, otočna cijena iz cjenika je već
    // konačna — isto pravilo vrijedi i s mrežom i bez nje.
    if (linija.seop_apply_discount !== true) {
        return ne('Linija ne primjenjuje SEOP popust — vrijedi cijena iz cjenika.');
    }

    const sifra = String(pravo || '').trim();
    if (!sifra) {
        return ne('Pravo se nije očitalo s kartice, pa se popust ne može odrediti.');
    }

    const upis = popusti.find((p) => String(p.code || '').trim() === sifra) || null;
    if (!upis || !(Number(upis.discount_pct) > 0)) {
        return ne(`Za pravo ${sifra} nije postavljen popust (Integracije → AKD → SEOP → Popusti).`);
    }

    // „Samo otočani s prebivalištem" — isto pravilo kao na poslužitelju:
    // iskaznica za „Svi otoci" prolazi svugdje, inače pravo mora biti
    // rezidentsko i otok s kartice mora biti otok jedne od luka relacije.
    if (linija.seop_mode === 'prebivaliste') {
        const otok = String(otokKartice || '').trim();
        const sviOtoci = /^svi\s*otoci$/i.test(otok);
        if (!sviOtoci) {
            if (upis.rezident !== true) {
                return ne(`Linija priznaje samo otočane s prebivalištem, a iskaznica nosi pravo ${sifra}.`);
            }
            const otociRelacije = (luke || [])
                .map((l) => String(l?.seop_island || '').trim())
                .filter(Boolean);
            const poklapa = otociRelacije.some((o) => o.toLowerCase() === otok.toLowerCase());
            if (otociRelacije.length && !poklapa) {
                return ne(`Iskaznica je za otok „${otok || '?'}", a linija priznaje otočane s: ${otociRelacije.join(', ')}.`);
            }
        }
    }

    return {
        popust_postotak: Number(upis.discount_pct),
        primijenjen: true,
        razlog: `Popust ${Number(upis.discount_pct)}% po pravu ${sifra} — iz lokalnog šifarnika, bez provjere u SEOP-u.`,
    };
};
