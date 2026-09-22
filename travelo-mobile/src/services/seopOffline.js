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
    // Tri moguca ishoda, i razlika medu njima odreduje sto se nudi:
    //   odluceno + pravo_vrijedi  -> karta se prodaje po pravilima linije
    //   odluceno + !pravo_vrijedi -> kartica na ovoj relaciji nema pravo
    //   !odluceno                 -> nema se po cemu odluciti (ostaje izdavanje uz razlog)
    const neznam = (razlog) => ({ odluceno: false, pravo_vrijedi: false, primjeni_popust: false, popust_postotak: 0, primijenjen: false, razlog });
    const nema = (razlog) => ({ odluceno: true, pravo_vrijedi: false, primjeni_popust: false, popust_postotak: 0, primijenjen: false, razlog });

    if (!linija) {
        return neznam('Postavke linije nisu poznate, pa se pravo ne može odrediti.');
    }
    if (linija.seop_mode === 'ne') {
        return nema('Na ovoj liniji otočne iskaznice se ne priznaju.');
    }

    const sifra = String(pravo || '').trim();
    if (!sifra) {
        return neznam('Pravo se nije očitalo s kartice, pa se ne može odrediti.');
    }

    const upis = popusti.find((p) => String(p.code || '').trim() === sifra) || null;

    // „Samo otočani s prebivalištem" — isto pravilo kao na poslužitelju:
    // iskaznica za „Svi otoci" prolazi svugdje, inače pravo mora biti
    // rezidentsko i otok s kartice mora biti otok jedne od luka relacije.
    if (linija.seop_mode === 'prebivaliste') {
        const otok = String(otokKartice || '').trim();
        const sviOtoci = /^svi\s*otoci$/i.test(otok);
        if (!sviOtoci) {
            // Je li pravo rezidentsko piše samo u šifarniku; bez njega se ta
            // odluka ne smije nagađati ni u jednom smjeru.
            if (!upis) {
                return neznam(`Za pravo ${sifra} nema podataka u lokalnom šifarniku (Integracije → AKD → SEOP → Popusti).`);
            }
            if (upis.rezident !== true) {
                return nema(`Linija priznaje samo otočane s prebivalištem, a iskaznica nosi pravo ${sifra}.`);
            }
            const otociRelacije = (luke || [])
                .map((l) => String(l?.seop_island || '').trim())
                .filter(Boolean);
            const poklapa = otociRelacije.some((o) => o.toLowerCase() === otok.toLowerCase());
            if (otociRelacije.length && !poklapa) {
                return nema(`Iskaznica je za otok „${otok || '?'}", a linija priznaje otočane s: ${otociRelacije.join(', ')}.`);
            }
        }
    }

    // Pravo vrijedi. Kako se računa cijena, odlučuje linija — isto pravilo kao s
    // mrežom: ili se na cijenu iz cjenika primijeni postotak, ili vrijedi
    // otočna cijena kakva jest.
    if (linija.seop_apply_discount !== true) {
        return {
            odluceno: true,
            pravo_vrijedi: true,
            primjeni_popust: false,
            popust_postotak: 0,
            primijenjen: false,
            razlog: `Pravo ${sifra} s kartice — linija ne primjenjuje SEOP popust, pa vrijedi otočna cijena iz cjenika.`,
        };
    }

    // Linija popust primjenjuje, ali se postotak ne zna. Prodaja po otočnoj
    // cijeni bi tada naplatila više nego što pripada, pa se radije ne odlučuje.
    if (!upis || !(Number(upis.discount_pct) > 0)) {
        return neznam(`Za pravo ${sifra} nije postavljen popust (Integracije → AKD → SEOP → Popusti).`);
    }

    return {
        odluceno: true,
        pravo_vrijedi: true,
        primjeni_popust: true,
        popust_postotak: Number(upis.discount_pct),
        primijenjen: true,
        razlog: `Popust ${Number(upis.discount_pct)}% po pravu ${sifra} — iz lokalnog šifarnika, bez provjere u SEOP-u.`,
    };
};
