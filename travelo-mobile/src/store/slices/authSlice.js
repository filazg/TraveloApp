import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api, { storage } from '../../api/client';
import { ENDPOINTS } from '../../api/config';

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
            });
    },
});

export const { setOperator, logoutOperator, clearError } = authSlice.actions;
export const authData = (state) => state.auth;
export default authSlice.reducer;
