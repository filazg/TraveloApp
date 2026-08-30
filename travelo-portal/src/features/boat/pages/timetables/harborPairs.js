// Parovi luka za koje se unosi cijena.
//
// Uobicajeno se cijena unosi po smjeru, pa se prikazuju svi uredeni parovi.
// Kad plovidbeni red ima ukljuceno "cijena jednaka za oba smjera", relacija se
// unosi jednom: prikazuje se samo smjer kojim brod prvi prolazi (Split–Hvar),
// a povratni dobiva istu cijenu pri spremanju, na posluzitelju.
export const buildHarborPairs = (uniqueHarbors, samePriceBothWays) => {
    const luke = uniqueHarbors || [];
    const pairs = [];
    let counter = 0;
    for (let i = 0; i < luke.length; i++) {
        for (let j = 0; j < luke.length; j++) {
            if (i === j) continue;
            // Isti par u suprotnom smjeru preskace se — vec je unesen.
            if (samePriceBothWays && j < i) continue;
            counter += 1;
            pairs.push({
                id: counter,
                harbor_from: luke[i].departure_harbor_name,
                harbor_from_code: luke[i].departure_harbor_id,
                harbor_to: luke[j].departure_harbor_name,
                harbor_to_code: luke[j].departure_harbor_id,
                vat_base: 0,
                vat_amount: 0,
                port_tax: 0,
                price: 0,
            });
        }
    }
    return pairs;
};
