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

export const fetchPrices = createAsyncThunk('sales/fetchPrices', async (partnerUuid, { rejectWithValue }) => {
  try {
    // Partner prodaje u svoje ime, pa mu se moze prikazivati nasa cijena prema
    // njemu — bez PDV-a, s luckom pristojbom u sebi. Odlucuje zastavica na
    // partneru; posluzitelj vraca ono sto na njoj pise.
    const res = await api.get('/sales/prices', {
      params: { channel: 'partner_web', partner_uuid: partnerUuid || undefined },
    })
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

// Moje rezervacije — sto je ovaj partner prodao. Razdoblje se mjeri po trenutku
// rezervacije, ne po polasku: partner trazi "sto sam prodao u kolovozu", a
// polazak zna biti mjesecima poslije.
export const fetchReservations = createAsyncThunk('sales/fetchReservations', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/sales/orders', { params })
    return res.data.orders || []
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message })
  }
})

// Karte jedne rezervacije se dohvacaju tek kad se rezervacija otvori: popis ih
// ne treba, a jedna rezervacija zna nositi desetak karata.
export const fetchOrderTickets = createAsyncThunk('sales/fetchOrderTickets', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/sales/order_tickets', { params })
    return res.data.tickets || []
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
    // Cjenik ima svoju zastavicu: dohvaca se pri otvaranju dijaloga rezervacije,
    // pa se ne smije mijesati s dohvatom luka i polazaka na pretrazi.
    pricesLoading: false,
    error: null,
    orderSubmitting: false,
    lastOrder: null,
    orderError: null,
    reservations: [],
    reservationsLoading: false,
    reservationsError: null,
    orderTickets: [],
    orderTicketsLoading: false,
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
      .addCase(fetchPrices.pending, (s) => { s.pricesLoading = true })
      .addCase(fetchPrices.fulfilled, (s, a) => { s.pricesLoading = false; s.prices = a.payload })
      .addCase(fetchPrices.rejected, (s, a) => { s.pricesLoading = false; s.error = a.payload?.message || 'Cjenik nije dohvacen' })
      .addCase(fetchReservations.pending, (s) => { s.reservationsLoading = true; s.reservationsError = null })
      .addCase(fetchReservations.fulfilled, (s, a) => { s.reservationsLoading = false; s.reservations = a.payload })
      .addCase(fetchReservations.rejected, (s, a) => {
        s.reservationsLoading = false
        s.reservationsError = a.payload?.message || 'Greška pri dohvatu rezervacija'
      })
      .addCase(fetchOrderTickets.pending, (s) => { s.orderTicketsLoading = true; s.orderTickets = [] })
      .addCase(fetchOrderTickets.fulfilled, (s, a) => { s.orderTicketsLoading = false; s.orderTickets = a.payload })
      .addCase(fetchOrderTickets.rejected, (s) => { s.orderTicketsLoading = false })
      .addCase(createOrder.pending, (s) => { s.orderSubmitting = true; s.orderError = null })
      .addCase(createOrder.fulfilled, (s, a) => { s.orderSubmitting = false; s.lastOrder = a.payload })
      .addCase(createOrder.rejected, (s, a) => { s.orderSubmitting = false; s.orderError = a.payload?.message || 'Rezervacija nije uspjela' })
  },
})

export const { clearLastOrder } = salesSlice.actions
export default salesSlice.reducer
