// Prijevod bloka `povlastica` sa stavke prodaje u polja na karti.
//
// Blok slažu blagajna, mobilna i web nakon provjere u akd servisu; ovdje se
// samo prepisuje, bez tumačenja. Namjerno se ništa ne izračunava: popust,
// pravo i odluka došli su s poslužitelja i karta ih pamti onakve kakvi jesu, da
// se dojava poslije može složiti iz zapisa, a ne iz nagađanja.
//
// Podržava se i stariji plosnati oblik (seop_card_no, seop_pravo, …) koji su
// klijenti slali prije uvođenja bloka — karte prodane u međuvremenu ne smiju
// ostati bez podataka.
const broj = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const poljaPovlastice = (stavka = {}) => {
    const p = stavka.povlastica || null;

    if (!p) {
        return {
            is_island: stavka.is_island === true,
            seop_card_no: stavka.seop_card_no || null,
            seop_pravo: stavka.seop_pravo || null,
            seop_otok: stavka.seop_otok || null,
            seop_discount_pct: stavka.seop_discount_pct ?? null,
            seop_sustav: stavka.is_island === true ? "SEOP" : null,
            seop_id_vrsta: stavka.seop_card_no ? "card_no" : null,
            seop_token: null,
            seop_namjena: stavka.seop_namjena || null,
            seop_redovna_cijena: broj(stavka.seop_redovna_cijena),
            seop_odobrenje: null,
            seop_uvijek_prodaj: false,
            seop_offline: false,
            seop_pratnja: false,
            seop_dojava: stavka.is_island === true,
        };
    }

    return {
        is_island: true,
        seop_card_no: p.identifikator?.vrijednost || stavka.seop_card_no || null,
        seop_pravo: p.pravo || p.pravo_na_pp || null,
        seop_otok: p.otok || null,
        seop_discount_pct: p.popust_postotak ?? null,
        seop_sustav: p.sustav || "SEOP",
        seop_id_vrsta: p.identifikator?.vrsta || null,
        seop_token: p.token || null,
        seop_namjena: p.namjena || null,
        seop_redovna_cijena: broj(p.redovna_cijena),
        seop_odobrenje: p.odobrenje || null,
        seop_uvijek_prodaj: p.uvijek_prodaj === true,
        seop_offline: p.offline === true,
        seop_pratnja: p.pratnja === true,
        // Linija moze koristiti SEOP samo za provjeru; tada karta ne ide u dojavu.
        seop_dojava: p.dojava_seop !== false,
    };
};

module.exports = { poljaPovlastice };
