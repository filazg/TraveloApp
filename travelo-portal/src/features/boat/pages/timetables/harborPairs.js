// Parovi luka za koje se unosi cijena.
//
// Uvijek se grade svi uredeni parovi — cijena se u pravilu vodi po smjeru.
//
// Luke se skupljaju iz polazaka I dolazaka, redom kojim se prvi put pojave.
// Samo iz polazaka nije dovoljno: red u jednom smjeru (npr. Split → Vis
// nedjeljom) ima polazak samo iz Splita, pa Vis nije ulazio u popis i nije
// nastajala nijedna relacija za cijenu.
export const buildHarborPairs = (uniqueHarbors) => {
    const luke = [];
    const dodaj = (kod, naziv) => {
        if (!kod || luke.some((l) => l.departure_harbor_id === kod)) return;
        luke.push({ departure_harbor_id: kod, departure_harbor_name: naziv });
    };
    for (const r of uniqueHarbors || []) {
        dodaj(r.departure_harbor_id, r.departure_harbor_name);
        dodaj(r.arrival_harbor_id, r.arrival_harbor_name);
    }
    const pairs = [];
    let counter = 0;
    for (const har of luke) {
        for (const other of luke) {
            if (other.departure_harbor_id === har.departure_harbor_id) continue;
            counter += 1;
            pairs.push({
                id: counter,
                harbor_from: har.departure_harbor_name,
                harbor_from_code: har.departure_harbor_id,
                harbor_to: other.departure_harbor_name,
                harbor_to_code: other.departure_harbor_id,
                vat_base: 0,
                vat_amount: 0,
                port_tax: 0,
                price: 0,
            });
        }
    }
    return pairs;
};

// Kad cijena vrijedi u oba smjera, relacija se prikazuje jednom — u smjeru
// kojim brod prvi prolazi (Split–Hvar). Povratni smjer dobiva istu cijenu pri
// spremanju, na posluzitelju.
//
// Redoslijed luka se cita iz samog popisa: prvi put kad se luka pojavi. Tako
// vrijedi i za parove iz baze i za novo izgradene.
export const collapseHarborPairs = (pairs) => {
    const redoslijed = [];
    for (const p of pairs || []) {
        if (!redoslijed.includes(p.harbor_from_code)) redoslijed.push(p.harbor_from_code);
        if (!redoslijed.includes(p.harbor_to_code)) redoslijed.push(p.harbor_to_code);
    }
    const mjesto = (kod) => redoslijed.indexOf(kod);
    return (pairs || []).filter((p) => mjesto(p.harbor_from_code) < mjesto(p.harbor_to_code));
};
