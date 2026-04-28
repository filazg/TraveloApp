import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { api } from '../../app/api'

export const fetchHarbors = createAsyncThunk('sales/fetchHarbors', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/sales/harbors')
    return res.data.harbors || []
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message })
  }
})

export const fetchRoutes = createAsyncThunk('sales/fetchRoutes', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/sales/routes')
    return res.data.routes || []
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message })
  }
})

export const fetchPrices = createAsyncThunk('sales/fetchPrices', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/sales/prices')
    return res.data.prices || []
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message })
  }
})

export const createOrder = createAsyncThunk('sales/createOrder', async (payload, { rejectWithValue }) => {
  try {
    const res = await api.post('/sales/orders', payload)
    return res.data.order || res.data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message })
  }
})

const salesSlice = createSlice({
  name: 'sales',
  initialState: {
    harbors: [],
    routes: [],
    prices: [],
    loading: false,
    error: null,
    orderSubmitting: false,
    lastOrder: null,
    orderError: null,
  },
  reducers: {
    clearLastOrder(state) {
      state.lastOrder = null
      state.orderError = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHarbors.pending, (s) => { s.loading = true; s.error = null })
      .addCase(fetchHarbors.fulfilled, (s, a) => { s.loading = false; s.harbors = a.payload })
      .addCase(fetchHarbors.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || 'Greška' })
      .addCase(fetchRoutes.pending, (s) => { s.loading = true; s.error = null })
      .addCase(fetchRoutes.fulfilled, (s, a) => { s.loading = false; s.routes = a.payload })
      .addCase(fetchRoutes.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || 'Greška' })
      .addCase(fetchPrices.fulfilled, (s, a) => { s.prices = a.payload })
      .addCase(createOrder.pending, (s) => { s.orderSubmitting = true; s.orderError = null })
      .addCase(createOrder.fulfilled, (s, a) => { s.orderSubmitting = false; s.lastOrder = a.payload })
      .addCase(createOrder.rejected, (s, a) => { s.orderSubmitting = false; s.orderError = a.payload?.message || 'Rezervacija nije uspjela' })
  },
})

export const { clearLastOrder } = salesSlice.actions
export default salesSlice.reducer
