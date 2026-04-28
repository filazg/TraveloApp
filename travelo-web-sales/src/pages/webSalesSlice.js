import axios from "axios";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import { url } from "../config/config"

const initialState = {
    selectedLanguage:{ code: "hr", label: "Hrvatski", short: "HR" },
    langs: [
        { code: "hr", label: "Hrvatski", short: "HR" },
        { code: "en", label: "English", short: "EN" },
    ],
    transportData: {
        harbors: []
    },
    searchData:{},
    selectedData:{
      counter:[],
      selectedTrip: null,
    },
    salesData:{
      tickets:[],
      preparedTickets: [],
      buyerData: {},
      orderNumber: null,
    },
    tripsData:{
      trips:[]
    },
    statuses: {
      canSelectTrips: false,
      selectTicketType: false,
      validateBuyerData: false,
    },
    // Globalni loading overlay — prikazuje se preko cijele stranice s porukom.
    // Setan iz dispatch akcija pri async operacijama (provjera iskaznice,
    // narudžba, plaćanje) — zatvara automatski po završetku ili greški.
    globalLoading: { active: false, message: '' },
    status: 'idle',
}

const toParts = (path) => {
  if (Array.isArray(path)) return path
  if (typeof path !== "string") throw new Error("path mora biti string ili array")
  return path.split("/").filter(Boolean) // "a/b/c" -> ["a","b","c"]
}

const getDeep = (obj, path) => {
  const parts = toParts(path)
  let cur = obj
  for (const k of parts) {
    if (cur == null) return undefined
    cur = cur[k]
  }
  return cur
}

const setDeep = (state, path, value) => {
  const parts = toParts(path)
  if (parts.length === 0) return

  let cur = state
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {}
    cur = cur[k]
  }
  cur[parts[parts.length - 1]] = value
}

const resetDeep = (state, path, initialState) => {
  const initialValue = getDeep(initialState, path)
  setDeep(state, path, initialValue)
}

export const getDataThunk = createAsyncThunk(
  "webSales/getDataThunk",
  async (arg, { getState }) => {
    const path = arg.path;
    const response = await axios.get(url + "/" + path);
    return response.data;
  }
);

export const postDataThunk = createAsyncThunk(
  "webSales/postDataThunk",
  async (arg, { getState }) => {
    console.log(arg);
    const data = arg.data;
    const path = arg.path;
    try {
      const response = await axios.post(url + "/" + path, data);
      return response.data;
    } catch (error) {}
  }
);

const webSalesSlice = createSlice({
    name: "webSales",
    initialState,
    reducers: {
        setWebSalesData(state, action) {
            console.log('SET STATE DATA:', action.payload)
            const { path, value, updates } = action.payload || {}
            if (Array.isArray(updates)) {
                for (const u of updates) setDeep(state, u.path, u.value)
                return
            }
            setDeep(state, path, value)
        },
        resetWebSalesData(state, action) {
            const { path, paths, updates } = action.payload || {}
            console.log(action.payload)
            if (Array.isArray(updates)) {
                for (const u of updates) resetDeep(state, u.path, initialState)
                return
            }
            if (Array.isArray(paths)) {
                for (const p of paths) resetDeep(state, p, initialState)
                return
            }resetDeep(state, path, initialState)
        },
        updateTicketsCounter: (state, action) =>{
          console.log(action.payload)
          const {path, value} = action.payload
          let counter = state.selectedData.counter.find((counter) => counter.id === path)
          if(counter){
            counter.id= value.id
            counter.quantity = value.quantity
            counter.data= value.data
          }
        },
        setStatus(state, action) {
          const { path, value } = action.payload || {}
          setDeep(state.statuses, path, value)
        },
        setBuyerData(state, action) {
          const { path, value } = action.payload || {}
          setDeep(state.salesData.buyerData, path, value)
        },
        setPreparedTickets(state, action) {
          state.salesData.preparedTickets = action.payload?.value || []
        },
        setOrderNumber(state, action) {
          state.salesData.orderNumber = action.payload?.value || null
        },
        updateTickets(state, action) {
          state.salesData.tickets = action.payload?.value || []
        },
        resetTripData(state) {
          state.selectedData = { counter: [], selectedTrip: null }
          state.searchData = {}
          state.tripsData = { trips: [] }
          state.statuses.selectTicketType = false
        },
        resetTicketsData(state) {
          state.salesData = { tickets: [], preparedTickets: [], buyerData: {}, orderNumber: null }
        },
        setGlobalLoading(state, action) {
          const { active, message } = action.payload || {}
          state.globalLoading = { active: !!active, message: message || '' }
        },
    },
    extraReducers(builder) {
    builder
      .addCase(getDataThunk.pending, (state, action) => {
        state.status = "loading";
      })
      .addCase(getDataThunk.fulfilled, (state, action) => {
        console.log('PAYLOAD', action.payload)
        state.status = "completed";
        console.log(action.payload)
        state[action.payload.path]= action.payload.data;
      })
      .addCase(getDataThunk.rejected, (state, action) => {
        state.status = "failed";
        //state.error.message = action.payload.message
      })
      .addCase(postDataThunk.pending, (state, action) => {
        state.status = "loading";
      })
      .addCase(postDataThunk.fulfilled, (state, action) => {
        state.status = "completed";
        console.log(action.payload)
        state[action.payload.path] = action.payload.data;
      })
      .addCase(postDataThunk.rejected, (state, action) => {
        state.status = "failed";
        //state.error.message = action.payload.message
      });
  },
})

export const {
    setWebSalesData,
    resetWebSalesData,
    updateTicketsCounter,
    setStatus,
    setBuyerData,
    setPreparedTickets,
    setOrderNumber,
    updateTickets,
    resetTripData,
    resetTicketsData,
    setGlobalLoading,
} = webSalesSlice.actions

export const webSalesDataSlice = (state) => state.webSales

export default webSalesSlice.reducer