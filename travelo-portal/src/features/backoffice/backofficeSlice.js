import axios from "axios";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"

const prod = false
const backendURL = prod ? "https://bookingtest.krilo.hr/app" :"http://localhost:5100"

const initialState = {
    backofficeData:{
        company:{},
        business_premises:[],
        users:[],
        partners:[],
        payment_methods:[],
        payment_types:[],
        holidays:[],
        countries:[],
        accounts:[],
        account_mappings:[],
    },
    web_portal_modules:[
        {
            id:1,
            module_acr:'TRAD',
            module_name:'Transport admin'
        },
        {
            id:2,
            module_acr:'DISP',
            module_name: 'Dispatcher'
        },
        {
            id:3,
            module_acr:'SALE',
            module_name: 'Sale'
        },
        {
            id:4,
            module_acr:'KAPETAN',
            module_name: 'Kapetan'
        },
        {
            id:5,
            module_acr:'BAOF',
            module_name: 'Backoffice'
        },
        {
            id:6,
            module_acr:'REPO',
            module_name: 'Reports'
        },
        {
            id:7,
            module_acr:'FINA',
            module_name: 'Finance'
        },
        {
            id:8,
            module_acr:'MANA',
            module_name: 'Menađment'
        },
    ],
}

const api = axios.create({
    baseURL: backendURL,
    withCredentials: true, // 🔑 OBAVEZNO za cookie
    headers: {
        "Content-Type": "application/json",
    },
});

export const getBackofficeThunk = createAsyncThunk('backoffice/getBackofficeThunk', async (arg) => {
    const path = arg.path
    try {
        const response = await api.get('/portal/backoffice/' + path)
        console.log(response.data)
        return (response.data)
        
    } catch (error) {
        console.log(error)
        
    }
})


export const postBackofficeThunk = createAsyncThunk('backoffice/postBackofficeThunk', async (arg) => {
    const data = arg.data
    const path = arg.path
    try {
        const response = await api.post('/portal/backoffice/' + path, data)
        console.log(response.data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
})

export const patchBackofficeThunk = createAsyncThunk('backoffice/patchBackofficeThunk', async (arg) => {
    const data = arg.data
    const path = arg.path
    try {
        const response = await api.patch('/portal/backoffice/' + path, data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
}) 

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

const backofficeSlice =createSlice({
    name:'backoffice',
    initialState,
    reducers:{
        setBackofficeData(state, action) {
            const { path, value, updates } = action.payload || {}
            if (Array.isArray(updates)) {
                for (const u of updates) setDeep(state, u.path, u.value)
                return
            }
            setDeep(state, path, value)
        },
        resetBackofficeData(state, action) {
            const { path, paths, updates } = action.payload || {}
            if (Array.isArray(updates)) {
                for (const u of updates) resetDeep(state, u.path, initialState)
                return
            }
            if (Array.isArray(paths)) {
                for (const p of paths) resetDeep(state, p, initialState)
                return
            }resetDeep(state, path, initialState)
        },
    },
    extraReducers(builder){
        builder
        .addCase(getBackofficeThunk.pending, (state, action) => {
            state.status = "loading";
        })
        .addCase(getBackofficeThunk.fulfilled, (state, action) => {
            state.status = "completed";
            console.log(action.payload);
            state[action.payload.path1][action.payload.path2] = action.payload.data;
        })
        .addCase(getBackofficeThunk.rejected, (state, action) => {
            state.status = "failed";
            state.errorMessage = action.error.message;
        })
        .addCase(postBackofficeThunk.pending, (state, action) => {
            state.status = "loading";
        })
        .addCase(postBackofficeThunk.fulfilled, (state, action) => {
            state.status = "succeeded";
            state[action.payload.path1][action.payload.path2]  = action.payload.data;
        })
        .addCase(postBackofficeThunk.rejected, (state, action) => {
            state.status = "failed";
            state.errorMessage = action.error.message;
        })
        .addCase(patchBackofficeThunk.pending, (state, action) => {
            state.status = "loading";
        })
        .addCase(patchBackofficeThunk.fulfilled, (state, action) => {
            state.status = "succeeded";
            state[action.payload.path1][action.payload.path2]= action.payload.data;
        })
        .addCase(patchBackofficeThunk.rejected, (state, action) => {
            state.status = "failed";
            state.errorMessage = action.error.message;
        });
    }
})

export const {
    setBackofficeData,
    resetBackofficeData
} = backofficeSlice.actions

export const backofficeSliceData = (state) => state.backoffice

export default backofficeSlice.reducer