import axios from "axios";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { resolveBackendUrl } from "../../helpers/backendUrl"

const backendURL = resolveBackendUrl('/app')

const initialState = {
    boatData:{
        lines:[],
        harbors:[],
        boats:[],
        regions:[],
        tickets_types:[],
        linesTypes:[
            {
                id:1,
                name:'Državna',
                subsidised_line:true
            },
            {
                id:2,
                name:'Komercijalna',
                subsidised_line:false
            },
        ],
        bookingTypes:[
        {
          id:1,
          uuid:'91de379d-06c4-4550-bbdd-0d5b42dc0ca4',
          name:'Redovna karta',
          acr:'BAS',
          is_active:true
        },
        {
          id:2,
          uuid:'756f8e92-2f83-44fc-b6d8-3de25905d758',
          name:'Vip karta',
          acr:'VIP',
          is_active:true
        },
        {
          id:3,
          uuid:'819d5dd8-18b5-4c02-9aef-4d7fc9accbf6',
          acr:'PET',
          name:'Male Životinje',
          is_active:true
        },
        {
          id:4,
          uuid:'b229d7f7-ae48-4d58-b524-806f9aa1ca03',
          acr:'BIC',
          name:'Bicikli',
          is_active:true
        },
      ],
    },
    newData:{
        timetableData:{},
        departuresForTimetable:[],
        harborPairsForTimetable:[],
        pairsForTimetable:[],
        timetablePrices:[],
    },
    editData:{
        timetableData:{},
        departuresForTimetable:[],
        harborPairsForTimetable:[],
        pairsForTimetable:[],
        timetablePrices:[],
    }
}

const api = axios.create({
    baseURL: backendURL,
    timeout: 60000,
    withCredentials: true, // 🔑 OBAVEZNO za cookie
    headers: {
        "Content-Type": "application/json",
    },
});

export const getBoatThunk = createAsyncThunk('boat/getBoatThunk', async (arg) => {
    const path = arg.path
    try {
        const response = await api.get('/portal/boat/' + path)
        return (response.data)
        
    } catch (error) {
        console.log(error)
        
    }
})


export const postBoatThunk = createAsyncThunk('boat/postBoatThunk', async (arg) => {
    const data = arg.data
    const path = arg.path
    try {
        const response = await api.post('/portal/boat/' + path, data)
        console.log(response.data)
        return (response.data)
    } catch (error) {
        console.log(error)
    }
})

export const patchBoatThunk = createAsyncThunk('boat/patchBoatThunk', async (arg) => {
    const data = arg.data
    const path = arg.path
    try {
        const response = await api.patch('/portal/boat/' + path, data)
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

const boatSlice = createSlice({
    name:'boat',
    initialState,
    reducers:{
        setBoatData(state, action) {
            const { path, value, updates } = action.payload || {}
            if (Array.isArray(updates)) {
                for (const u of updates) setDeep(state, u.path, u.value)
                return
            }
            setDeep(state, path, value)
        },
        resetBoatData(state, action) {
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
        .addCase(getBoatThunk.pending, (state, action) => {
            state.status = "loading";
        })
        .addCase(getBoatThunk.fulfilled, (state, action) => {
            state.status = "completed";
            console.log(action.payload);
            state[action.payload.path1][action.payload.path2] = action.payload.data;
        })
        .addCase(getBoatThunk.rejected, (state, action) => {
            state.status = "failed";
            state.errorMessage = action.error.message;
        })
        .addCase(postBoatThunk.pending, (state, action) => {
            state.status = "loading";
        })
        .addCase(postBoatThunk.fulfilled, (state, action) => {
            state.status = "succeeded";
            state[action.payload.path1][action.payload.path2]  = action.payload.data;
        })
        .addCase(postBoatThunk.rejected, (state, action) => {
            state.status = "failed";
            state.errorMessage = action.error.message;
        })
        .addCase(patchBoatThunk.pending, (state, action) => {
            state.status = "loading";
        })
        .addCase(patchBoatThunk.fulfilled, (state, action) => {
            state.status = "succeeded";
            state[action.payload.path1][action.payload.path2]= action.payload.data;
        })
        .addCase(patchBoatThunk.rejected, (state, action) => {
            state.status = "failed";
            state.errorMessage = action.error.message;
        });
    }
})

export const {
    setBoatData,
    resetBoatData
} = boatSlice.actions

export const boatSliceData = (state) =>state.boat

export default boatSlice.reducer