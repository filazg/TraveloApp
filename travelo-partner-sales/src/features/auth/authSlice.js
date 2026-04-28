import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { api } from '../../app/api'

export const login = createAsyncThunk(
  'auth/login',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/login/partnerLogin', { username, password })
      return res.data
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message })
    }
  }
)

export const checkSession = createAsyncThunk(
  'auth/checkSession',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/auth/login/partnerMe')
      return res.data
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message })
    }
  }
)

export const logoutRemote = createAsyncThunk(
  'auth/logout',
  async () => {
    try { await api.post('/auth/login/partnerLogout') } catch (_) {}
    return true
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    partner: null,
    loading: false,
    error: null,
    bootChecked: false,
  },
  reducers: {
    clearAuth(state) {
      state.user = null
      state.partner = null
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        const u = action.payload.user || action.payload.data || action.payload
        state.user = u
        state.partner = u?.partner_uuid
          ? { uuid: u.partner_uuid, name: u.partner_name }
          : null
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload?.message || 'Prijava nije uspjela'
      })
      .addCase(checkSession.fulfilled, (state, action) => {
        const u = action.payload.data || action.payload.user
        if (u) {
          state.user = u
          state.partner = u?.partner_uuid
            ? { uuid: u.partner_uuid, name: u.partner_name }
            : null
        }
        state.bootChecked = true
      })
      .addCase(checkSession.rejected, (state) => {
        state.user = null
        state.partner = null
        state.bootChecked = true
      })
      .addCase(logoutRemote.fulfilled, (state) => {
        state.user = null
        state.partner = null
      })
  },
})

export const { clearAuth } = authSlice.actions
export default authSlice.reducer
