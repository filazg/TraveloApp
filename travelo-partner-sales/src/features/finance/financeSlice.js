import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { api } from '../../app/api'

// Financijski pregled partnera. Sve ide preko sales-servisa, koji partnera uzima
// iz prijave — klijent ne salje svoj uuid, pa se tudi promet ne moze zatraziti.

export const fetchCommission = createAsyncThunk('finance/commission', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/sales/partner_finance/commission', { params })
    return { period: params.period || 'closed', data: res.data }
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message })
  }
})

export const fetchInvoices = createAsyncThunk('finance/invoices', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/sales/partner_finance/invoices', { params })
    return res.data.invoices || []
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message })
  }
})

export const fetchInvoice = createAsyncThunk('finance/invoice', async (uuid, { rejectWithValue }) => {
  try {
    const res = await api.get(`/sales/partner_finance/invoice/${uuid}`)
    return res.data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: err.message })
  }
})

// PDF stize kao blob i odmah zavrsi u datoteci; u stanju nema sto stajati.
const preuzmiPdf = async (putanja, params, naziv) => {
  const res = await api.get(putanja, { params, responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = naziv
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const preuzmiIzvjestajPdf = (params, detalji) =>
  preuzmiPdf(
    `/sales/partner_finance/${detalji ? 'report_details_pdf' : 'report_pdf'}`,
    params,
    `izvjestaj-provizija${detalji ? '-detalji' : ''}.pdf`
  )

export const preuzmiRacunPdf = (uuid, detalji) =>
  preuzmiPdf(
    `/sales/partner_finance/${detalji ? 'invoice_details_pdf' : 'invoice_pdf'}/${uuid}`,
    {},
    `racun${detalji ? '-detalji' : ''}.pdf`
  )

const financeSlice = createSlice({
  name: 'finance',
  initialState: {
    commission: null,
    commissionOpen: null,
    commissionLoading: false,
    invoices: [],
    invoicesLoading: false,
    invoice: null,
    invoiceLoading: false,
    error: null,
  },
  reducers: {
    clearInvoice(state) { state.invoice = null },
  },
  extraReducers: (b) => {
    b
      .addCase(fetchCommission.pending, (s) => { s.commissionLoading = true; s.error = null })
      .addCase(fetchCommission.fulfilled, (s, a) => {
        s.commissionLoading = false
        if (a.payload.period === 'current') s.commissionOpen = a.payload.data
        else s.commission = a.payload.data
      })
      .addCase(fetchCommission.rejected, (s, a) => {
        s.commissionLoading = false
        s.error = a.payload?.message || 'Greška pri dohvatu obračuna'
      })
      .addCase(fetchInvoices.pending, (s) => { s.invoicesLoading = true; s.error = null })
      .addCase(fetchInvoices.fulfilled, (s, a) => { s.invoicesLoading = false; s.invoices = a.payload })
      .addCase(fetchInvoices.rejected, (s, a) => {
        s.invoicesLoading = false
        s.error = a.payload?.message || 'Greška pri dohvatu računa'
      })
      .addCase(fetchInvoice.pending, (s) => { s.invoiceLoading = true; s.invoice = null })
      .addCase(fetchInvoice.fulfilled, (s, a) => { s.invoiceLoading = false; s.invoice = a.payload })
      .addCase(fetchInvoice.rejected, (s) => { s.invoiceLoading = false })
  },
})

export const { clearInvoice } = financeSlice.actions
export default financeSlice.reducer
