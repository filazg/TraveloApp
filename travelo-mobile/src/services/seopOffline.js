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

    // Linija popust primjenjuje, ali se stupanj ne zna. 0 % u šifarniku je i
    // zadana vrijednost nepopunjenog retka, pa se iz njega ne zaključuje da
    // prava nema — odluka ostaje operateru, uz razlog.
    if (!upis || !(Number(upis.discount_pct) > 0)) {
        return neznam(`Za pravo ${sifra} nije postavljen popust (Integracije → AKD → SEOP → Popusti).`);
    }

    const pct = Number(upis.discount_pct);
    return {
        odluceno: true,
        pravo_vrijedi: true,
        primjeni_popust: true,
        popust_postotak: pct,
        primijenjen: true,
        razlog: `${pct >= 100 ? 'Besplatna karta' : 'Otočna cijena'} po pravu ${sifra} — iz lokalnog šifarnika, bez provjere u SEOP-u.`,
    };
};

// Na liniji koja primjenjuje popust sa SEOP-a postotak nije množitelj nego
// stupanj prava (očitovanje AKD-a, 2026-09):
//   0 %   — nema prava na otočnu kartu
//   50 %  — otočna karta po cijeni iz cjenika otočnih karata
//   100 % — besplatna karta
// MOSI postotak dolazi iz postavki linije i ostaje pravi popust. Isto pravilo
// kao u blagajni (subsidisedHelpers.js).
const jeSeopStupanj = (ishod) =>
    ishod?.primjeni_popust === true && (ishod?.sustav || 'SEOP') === 'SEOP';

export const seopBezPrava = (ishod) =>
    jeSeopStupanj(ishod) && !(Number(ishod?.popust_postotak) > 0);

// Red cjenika po kojem se prodaje povlaštena karta za pravo — vrsta karte
// pridružena pravu u šifarniku popusta (portal: Integracije → AKD → SEOP →
// Popusti). Bez pridružene vrste, ili kad relacija nema cijenu te vrste,
// vrijedi opća otočna cijena. Isto pravilo kao u blagajni (subsidisedHelpers).
export const otocnaCijenaZaPravo = (cijene = [], popusti = [], pravo = null) => {
    const sifra = String(pravo || '').trim();
    const upis = sifra ? (popusti || []).find((p) => String(p.code || '').trim() === sifra) : null;
    if (upis?.ticket_type_uuid) {
        const red = (cijene || []).find((c) => c.ticket_type_uuid === upis.ticket_type_uuid && c.is_active !== false);
        if (red) return red;
    }
    return (cijene || []).find((c) => c.is_island === true && c.is_active !== false) || null;
};

export const opisSeopStupnja = (pct) =>
    Number(pct) >= 100 ? 'besplatno' : Number(pct) > 0 ? 'otočna cijena' : 'nema prava';

// Kako se računa povlaštena cijena, odlučuje linija (postavka u portalu):
//   primjeni_popust — SEOP: stupanj prava (100 % besplatno, inače otočna
//                     cijena); MOSI: na cijenu iz cjenika primijeni postotak
//   inače           — naplati cijenu iz cjenika, kakva jest
// Vrijedi i za lokalnu odluku bez mreže (popustBezMreze), koja uvijek znači SEOP.
export const cijenaPovlastene = (ishod, red) => {
    const osnovica = Number(red?.price || 0);
    if (!ishod?.primjeni_popust) return +osnovica.toFixed(2);
    const pct = Number(ishod.popust_postotak || 0);
    if (jeSeopStupanj(ishod)) return pct >= 100 ? 0 : +osnovica.toFixed(2);
    return +(osnovica * (1 - pct / 100)).toFixed(2);
};

// SEOP je pravo priznao, ali s 0 % — po stupnjevima to znači da otočne karte
// nema. Poslužitelj to još ne zna, pa se odgovor ovdje pretvara u odbijenu
// provjeru: bez tokena, a operateru ostaje izdavanje uz razlog.
export const primijeniStupanj = (ishod) => {
    if ((ishod?.smije_se_prodati ?? ishod?.ima_pravo) && seopBezPrava(ishod)) {
        return {
            ...ishod,
            ima_pravo: false,
            smije_se_prodati: false,
            token: null,
            // Pokazuje se SEOP-ova poruka (npr. „…nije s otoka Hvara te nema pravo…"); vlastiti tekst samo kad je nema.
            razlog: ishod.poruka || 'Korisnik nema pravo na otočnu kartu na ovoj relaciji.',
        };
    }
    return ishod;
};

// Dvije mogućnosti i ništa između: otočna cijena iz cjenika ili besplatno.
export const POPUSTI_POVJERENJE = [
    { pct: 0, naziv: 'Otočna cijena' },
    { pct: 100, naziv: 'Besplatno' },
];
