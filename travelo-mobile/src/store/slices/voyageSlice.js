import { createSlice } from '@reduxjs/toolkit';

// Selected voyage (polazak) for the device session.
// A voyage is identified by (timetable_uuid, sequence, departure_date) — matches
// how routes are grouped in the portal.
const voyageSlice = createSlice({
    name: 'voyage',
    initialState: {
        selectedLine: null,   // { uuid, code, name, ... }
        selected: null,       // voyage (polazak) once picked from the line's voyage list
    },
    reducers: {
        setLine(state, action) {
            state.selectedLine = action.payload;
            state.selected = null; // reset voyage when line changes
        },
        clearLine(state) {
            state.selectedLine = null;
            state.selected = null;
        },
        setVoyage(state, action) {
            state.selected = action.payload;
        },
        clearVoyage(state) {
            console.log('[voyageSlice] clearVoyage dispatched');
            state.selected = null;
        },
    },
});

export const { setLine, clearLine, setVoyage, clearVoyage } = voyageSlice.actions;
export const voyageData = (state) => state.voyage;
export default voyageSlice.reducer;
