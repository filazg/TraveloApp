import { createSlice } from '@reduxjs/toolkit';

// Top-level section the operator is in, after login.
//   null — main menu
//   'voyage' — plovidba flow (line → voyage → sale/validate)
//   'shifts' — zaključci smjena
//   'documents' — dokumenti
const navSlice = createSlice({
    name: 'nav',
    initialState: { section: null },
    reducers: {
        setSection(state, action) { state.section = action.payload; },
        resetSection(state) { state.section = null; },
    },
});

export const { setSection, resetSection } = navSlice.actions;
export const navData = (state) => state.nav;
export default navSlice.reducer;
