import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api, { storage } from '../../api/client';
import { ENDPOINTS } from '../../api/config';
import { getDeviceSerialNumber } from '../../device/printer';

// Zero-touch uparivanje — uređaj bez tokena javi svoj serijski broj i, ako je
// naplatni uređaj označen za automatsko uparivanje, odmah dobije token bez
// unosa TID-a i OTP-a. Sve ostalo (nepoznat SN, nema zastavice, nema mreže)
// završi na ekranu za ručno uparivanje; ako je SN prepoznat, TID se predpuni.
export const autoPairThunk = createAsyncThunk(
    'auth/autoPair',
    async (_, { rejectWithValue }) => {
        const serial = await getDeviceSerialNumber();
        if (!serial) return { mode: 'manual', serial: null, tid: null };
        try {
            const resp = await api.post(
                ENDPOINTS.terminalCheckPairing,
                { serial_number: serial },
                { headers: { skipAuth: true } },
            );
            const body = resp.data?.data || resp.data || {};
            if (body.mode === 'auto' && body.token) {
                await storage.setToken(body.token);
                await storage.setTid(body.tid);
                return { mode: 'auto', serial, token: body.token, tid: body.tid || null };
            }
            return { mode: 'manual', serial, tid: body.tid || null };
        } catch (err) {
            // Offline ili greška poslužitelja — ne blokiramo, idemo na ručno.
            console.log('autoPair:', err?.message || err);
            return rejectWithValue({ serial });
        }
    }
);

// Pairing — POST /terminal_auth/login/terminalLogin with {tid, otp}.
// Gateway wraps the auth main service and returns {status, data:{token, msg}}.
export const pairTerminalThunk = createAsyncThunk(
    'auth/pairTerminal',
    async ({ tid, otp, gatewayUrl }, { rejectWithValue }) => {
        try {
            if (gatewayUrl) await storage.setGateway(gatewayUrl);
            const resp = await api.post(ENDPOINTS.terminalLogin, { tid, otp }, { headers: { skipAuth: true } });
            // Gateway strips outer {status, data} wrapper for main services, so body = {msg, token}.
            // On failure, HTTP status stays 200 but token is missing and msg has reason.
            const body = resp.data?.data || resp.data || {};
            if (!body.token) {
                return rejectWithValue({ message: body.msg || 'Pairing nije uspio' });
            }
            await storage.setToken(body.token);
            await storage.setTid(tid);
            return { token: body.token, tid };
        } catch (err) {
            return rejectWithValue({ message: err.response?.data?.msg || err.message });
        }
    }
);

export const unpairTerminalThunk = createAsyncThunk(
    'auth/unpairTerminal',
    async () => {
        await storage.clearToken();
        return true;
    }
);

export const restoreTokenThunk = createAsyncThunk(
    'auth/restoreToken',
    async () => {
        const token = await storage.getToken();
        const gateway = await storage.getGateway();
        const tid = await storage.getTid();
        return { token: token || null, gateway, tid: tid || null };
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        token: null,
        gateway: null,
        tid: null,
        booting: true,
        pairing: false,
        error: null,
        // Zero-touch: SN uređaja, TID predložen po SN-u i je li provjera obavljena.
        serial: null,
        suggestedTid: null,
        autoPairing: false,
        autoPairChecked: false,
        // Operator-level login (set in-memory after basic_data sync; not persisted).
        operator: null,
    },
    reducers: {
        setOperator(state, action) {
            state.operator = action.payload;
        },
        logoutOperator(state) {
            state.operator = null;
        },
        clearError(state) {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(restoreTokenThunk.fulfilled, (s, a) => {
                s.token = a.payload.token;
                s.gateway = a.payload.gateway;
                s.tid = a.payload.tid;
                s.booting = false;
            })
            .addCase(restoreTokenThunk.rejected, (s) => { s.booting = false; })
            .addCase(autoPairThunk.pending, (s) => { s.autoPairing = true; })
            .addCase(autoPairThunk.fulfilled, (s, a) => {
                s.autoPairing = false;
                s.autoPairChecked = true;
                s.serial = a.payload.serial;
                if (a.payload.mode === 'auto') {
                    s.token = a.payload.token;
                    s.tid = a.payload.tid;
                } else {
                    s.suggestedTid = a.payload.tid;
                }
            })
            .addCase(autoPairThunk.rejected, (s, a) => {
                s.autoPairing = false;
                s.autoPairChecked = true;
                s.serial = a.payload?.serial || null;
            })
            .addCase(pairTerminalThunk.pending, (s) => { s.pairing = true; s.error = null; })
            .addCase(pairTerminalThunk.fulfilled, (s, a) => {
                s.pairing = false;
                s.token = a.payload.token;
                s.tid = a.payload.tid;
            })
            .addCase(pairTerminalThunk.rejected, (s, a) => {
                s.pairing = false;
                s.error = a.payload?.message || 'Greška';
            })
            .addCase(unpairTerminalThunk.fulfilled, (s) => {
                s.token = null;
                s.operator = null;
                // Nakon ručnog odparivanja ne uparujemo ponovno automatski u istoj
                // sesiji — inače se ekran za uparivanje ne bi mogao ni otvoriti.
                s.autoPairChecked = true;
            });
    },
});

export const { setOperator, logoutOperator, clearError } = authSlice.actions;
export const authData = (state) => state.auth;
export default authSlice.reducer;
