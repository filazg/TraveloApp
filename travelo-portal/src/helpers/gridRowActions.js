import { useEffect, useRef } from "react";

// Zajednički obrazac za tablice (preuzeto iz bus portala):
//   klik na redak      → uredi (otvara drawer)
//   dupli klik         → aktiviraj/deaktiviraj (is_active toggle)
//   neaktivni redci    → klasa "row-inactive" (prigušenje definirano u theme.js)
//
// Uputu iznad tablice renderira <GridHint /> iz helpers/GridHint.jsx.

// is_active === false → prigušen redak. Resursi bez tog polja ostaju neizmijenjeni.
// Neke tablice koriste drugo ime polja (npr. addressbook → buyer_is_active).
export const inactiveRowClass = (field = "is_active") => (params) =>
    (params.row?.[field] === false ? "row-inactive" : "");

// Timer razdvaja jednostruki od dvostrukog klika — bez njega bi dupli klik uvijek
// prvo otvorio drawer. Stranice bez is_active prosljeđuju samo onEdit, pa se klik
// izvršava odmah (nema čekanja na mogući drugi klik).
export function useRowClickActions({ onEdit, onToggle, delay = 220, activeField = "is_active" }) {
    const timer = useRef(null);

    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const onRowClick = (params) => {
        if (!onEdit) return;
        if (!onToggle) { onEdit(params.row); return; }
        if (timer.current) return;
        timer.current = setTimeout(() => { timer.current = null; onEdit(params.row); }, delay);
    };

    const onRowDoubleClick = (params) => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        if (onToggle) onToggle(params.row);
    };

    return { onRowClick, onRowDoubleClick, getRowClassName: inactiveRowClass(activeField) };
}
