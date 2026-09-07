import axios from "axios";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { resolveBackendUrl } from "../../helpers/backendUrl";

// Modul KONTROLA. Zaseban slice, ne dio financija: financije gledaju novac, a
// ovo gleda zloupotrebu — dva različita posla nad istim kartama.

const api = axios.create({
    baseURL: resolveBackendUrl("/app"),
    withCredentials: true,
});

// Portal → gateway → web_portal-service (BFF) → transactions-service.
// BFF odgovor: { status, data: { path1, path2, data: <sadržaj> } }.
const unwrapBff = (resp) => resp?.data?.data?.data ?? resp?.data?.data ?? resp?.data ?? {};

// Karte kod kojih je uhvaćen sukob original ↔ kopija. Jedan redak po karti; u
// detalju se otvara povijest te karte.
export const fetchCopyConflictsThunk = createAsyncThunk(
    "kontrola/fetchCopyConflicts",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/ticket_copy_conflicts", { params });
            return unwrapBff(resp)?.conflicts || [];
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

// Povijest jedne karte: svi pokušaji validacije, i neuspješni.
export const fetchTicketValidationsThunk = createAsyncThunk(
    "kontrola/fetchTicketValidations",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/ticket_validations", { params });
            return unwrapBff(resp)?.validations || [];
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

// Evidentirani ispisi kopija — odakle je kopija došla.
export const fetchCopyPrintsThunk = createAsyncThunk(
    "kontrola/fetchCopyPrints",
    async (params = {}, { rejectWithValue }) => {
        try {
            const resp = await api.get("/portal/transactions/ticket_copy_prints", { params });
            return unwrapBff(resp)?.copies || [];
        } catch (err) {
            return rejectWithValue(err.response?.data || { message: err.message });
        }
    }
);

const kontrolaSlice = createSlice({
    name: "kontrola",
    initialState: {
        conflicts: [],
        conflictsLoading: false,
        conflictsError: null,
        // Detalj odabrane karte — povijest validacija i ispisane kopije.
        // Drži se odvojeno od popisa: to su dva različita pogleda.
        detailTicketUuid: null,
        validations: [],
        copyPrints: [],
        detailLoading: false,
    },
    reducers: {
        // Zatvaranje detalja mora i očistiti sadržaj, inače bi se pri sljedećem
        // otvaranju nakratko vidjela tuđa povijest dok novi dohvat ne stigne.
        clearDetail(s) {
            s.detailTicketUuid = null;
            s.validations = [];
            s.copyPrints = [];
        },
        setDetailTicket(s, a) {
            s.detailTicketUuid = a.payload || null;
        },
    },
    extraReducers: (b) => {
        b
            .addCase(fetchCopyConflictsThunk.pending, (s) => {
                s.conflictsLoading = true;
                s.conflictsError = null;
            })
            .addCase(fetchCopyConflictsThunk.fulfilled, (s, a) => {
                s.conflictsLoading = false;
                s.conflicts = a.payload;
            })
            .addCase(fetchCopyConflictsThunk.rejected, (s, a) => {
                s.conflictsLoading = false;
                s.conflictsError = a.payload?.message || "Greška pri dohvatu sukoba";
            })
            .addCase(fetchTicketValidationsThunk.pending, (s) => {
                s.detailLoading = true;
            })
            .addCase(fetchTicketValidationsThunk.fulfilled, (s, a) => {
                s.detailLoading = false;
                s.validations = a.payload;
            })
            .addCase(fetchTicketValidationsThunk.rejected, (s) => {
                s.detailLoading = false;
                s.validations = [];
            })
            .addCase(fetchCopyPrintsThunk.fulfilled, (s, a) => {
                s.copyPrints = a.payload;
            })
            .addCase(fetchCopyPrintsThunk.rejected, (s) => {
                s.copyPrints = [];
            });
    },
});

export const { clearDetail, setDetailTicket } = kontrolaSlice.actions;
export const kontrolaSliceData = (state) => state.kontrola;
export default kontrolaSlice.reducer;
