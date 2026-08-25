import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

/**
 * Storage adapter:
 * - Ako postoji Electron preload API (window.api.*), koristi njega
 * - Fallback: localStorage
 */
const storage = {
  async load() {
    if (window?.api?.getAppStatus) {
      // očekuj npr: { isPaired: boolean, authToken?: string|null, themeMode?: "dark"|"light" }
      return await window.api.getAppStatus();
    }

    const isPaired = localStorage.getItem("isPaired") === "false";
    const authToken = localStorage.getItem("authToken");
    const themeMode = localStorage.getItem("themeMode") || "light";
    return { isPaired, authToken, themeMode };
  },

  async setPaired(isPaired) {
    if (window?.api?.setPaired) return window.api.setPaired(isPaired);
    localStorage.setItem("isPaired", String(isPaired));
  },

  async setAuthToken(token) {
    if (window?.api?.setAuthToken) return window.api.setAuthToken(token);
    if (token) localStorage.setItem("authToken", token);
    else localStorage.removeItem("authToken");
  },

  async setThemeMode(mode) {
    if (window?.api?.setThemeMode) return window.api.setThemeMode(mode);
    localStorage.setItem("themeMode", mode);
  },
};

/**
 * Bootstrapping aplikacije: učita isPaired + authToken + themeMode
 */
export const bootstrapApp = createAsyncThunk("app/bootstrap", async () => {
  const data = await storage.load();

  const isPaired = Boolean(data?.isPaired);
  const authToken = data?.authToken ?? null;

  // podrška za obje varijante: authToken ili isLoggedIn iz API-ja
  const isLoggedIn = data?.isLoggedIn ?? Boolean(authToken);

  // Svijetla tema je zadana; tamna se bira tek eksplicitno.
  const themeMode = data?.themeMode === "dark" ? "dark" : "light";

  return { isPaired, authToken, isLoggedIn, themeMode };
});

/**
 * Pairing: TID + OTP
 * - u Electronu: window.api.pairDevice({tid, otp})
 * - fallback: mock validacija (OTP 6 znamenki)
 */
export const pairDevice = createAsyncThunk(
  "app/pairDevice",
  async ({ tid, otp }, { dispatch, rejectWithValue }) => {
    try {
      const tidClean = String(tid ?? "").trim();
      const otpClean = String(otp ?? "").trim();

      if (!tidClean || !otpClean) {
        return rejectWithValue("TID i OTP su obavezni.");
      }

      if (window?.api?.pairDevice) {
        await window.api.pairDevice({ tid: tidClean, otp: otpClean });
      } else {
        // MOCK: OTP mora biti 6 znamenki
        if (!/^\d{6}$/.test(otpClean)) {
          return rejectWithValue("OTP mora imati 6 znamenki.");
        }
      }

      await storage.setPaired(true);
      dispatch(pairedSet(true));

      return true;
    } catch (e) {
      console.error(e);
      return rejectWithValue("Pairing nije uspio. Provjerite TID/OTP.");
    }
  }
);

/**
 * Login:
 * - u Electronu: window.api.login({username, password}) -> vrati token
 * - fallback: mock login (samo provjera da nisu prazni)
 */
export const login = createAsyncThunk(
  "app/login",
  async ({ username, password }, { dispatch, rejectWithValue }) => {
    try {
      const u = String(username ?? "").trim();
      const p = String(password ?? "").trim();

      if (!u || !p) return rejectWithValue("Unesite korisničko ime i lozinku.");

      let token = null;

      if (window?.api?.login) {
        const res = await window.api.login({ username: u, password: p });
        token = typeof res === "string" ? res : res?.token;
      } else {
        // MOCK token
        token = "dummy-token";
      }

      if (!token) return rejectWithValue("Neispravni podaci za prijavu.");

      await storage.setAuthToken(token);
      dispatch(authTokenSet(token));

      return token;
    } catch (e) {
      console.error(e);
      return rejectWithValue("Login nije uspio.");
    }
  }
);

/**
 * Logout: briše token
 */
export const logout = createAsyncThunk("app/logout", async (_, { dispatch }) => {
  await storage.setAuthToken(null);
  dispatch(authTokenSet(null));
  return true;
});

/**
 * Unpair: reset pairing + logout
 */
export const unpair = createAsyncThunk("app/unpair", async (_, { dispatch }) => {
  await storage.setPaired(false);
  await storage.setAuthToken(null);
  dispatch(pairedSet(false));
  dispatch(authTokenSet(null));
  return true;
});

const initialState = {
  status: "ready",
  loadingText:'Pričekajte...', // idle | loading | ready | error
  alertData:{},
  isPaired: false,
  isLoggedIn: false,
  authToken: null,
  modalsStates:{
    showSystemSettingsModal:false,
    showSubsidisedTickets:false,
    showSubsidisedTicketsData:false,
    shohConfirmLogout: false,
    showNewShiftView: false,
    showShiftView: false,
    showShiftSummary: false,
    shiftReportData:{},
    showInvoiceView:false,
    showInvoicePreviewModal:false,
    showTicketsModal:false,
    showShiftSummaryModal:false,
    showAddressBookModal:false,
    showOperatorSettingsModal:false
  },
  // Osobne postavke prijavljenog operatera (prečaci na tipkovnici).
  operatorSettings:{
    shortcuts:{}
  },
  // Zadnji pritisak dodijeljene funkcijske tipke: { action, ts, key }.
  // Komponenta koja tu radnju zna izvesti reagira na promjenu — vidi
  // components/common/shortcutActions.js.
  shortcutSignal:null,
  pairingData:{
    isPaired: false,
    tid: null,
    otp: null,
    token: null,
  },
  logedUser:{},
  shiftsData:{
    shifts:true
  },
  basicData:{},
  transportData:{},
  workingData:{
    selectedInvoice:{}
  },
  searchData:{},
  saleData:{},

  themeMode: localStorage.getItem("themeMode") || "light",

  error: null,
};

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

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    pairedSet(state, action) {
      state.pairingData = action.payload;
    },
    setStateData(state, action) {
      console.log('SET STATE DATA:', action.payload)
      const { path, value, updates } = action.payload || {}

      // više pathova odjednom
      if (Array.isArray(updates)) {
        for (const u of updates) setDeep(state, u.path, u.value)
        return
      }

      // jedan path
      setDeep(state, path, value)
    },
    resetStateData(state, action) {
      const { path, paths, updates } = action.payload || {}

      // 1) batch preko updates (isti shape kao set)
      if (Array.isArray(updates)) {
        for (const u of updates) resetDeep(state, u.path, initialState)
        return
      }

      // 2) batch preko paths: ["a/b", "x/y"]
      if (Array.isArray(paths)) {
        for (const p of paths) resetDeep(state, p, initialState)
        return
      }

  // 3) jedan path
  resetDeep(state, path, initialState)
},
    updateTicketsCounter: (state, action) =>{
      console.log(action.payload)
      const {path, value} = action.payload
      let counter = state.searchData.ticketsCounter.find((counter) => counter.id === path)
      if(counter){
        counter.id= value.id
        counter.quantity = value.quantity
        counter.data= value.data
      }
    },
    authTokenSet(state, action) {
      const token = action.payload ?? null;
      state.authToken = token;
      state.isLoggedIn = Boolean(token);
    },

    errorCleared(state) {
      state.error = null;
    },

    themeModeSet(state, action) {
      const mode = action.payload === "dark" ? "dark" : "light";
      state.themeMode = mode;
      // persist (fire and forget)
      storage.setThemeMode(mode);
    },

    themeModeToggled(state) {
      const next = state.themeMode === "dark" ? "light" : "dark";
      state.themeMode = next;
      // persist (fire and forget)
      storage.setThemeMode(next);
    },
  },
  extraReducers: (builder) => {
    builder
      // bootstrap
      .addCase(bootstrapApp.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(bootstrapApp.fulfilled, (state, action) => {
        state.status = "ready";
        state.isPaired = action.payload.isPaired;
        state.authToken = action.payload.authToken ?? null;
        state.isLoggedIn = action.payload.isLoggedIn;
        state.themeMode = action.payload.themeMode || state.themeMode;
      })
      .addCase(bootstrapApp.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error?.message ?? "Bootstrap failed";
      })

      // pairing
      .addCase(pairDevice.pending, (state) => {
        state.error = null;
      })
      .addCase(pairDevice.rejected, (state, action) => {
        state.error = action.payload ?? "Pairing failed";
      })

      // login
      .addCase(login.pending, (state) => {
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.error = action.payload ?? "Login failed";
      });
  },
});

export const {
  pairedSet,
  setStateData,
  resetStateData,
  updateTicketsCounter,
  authTokenSet,
  errorCleared,
  themeModeSet,
  themeModeToggled,
} = appSlice.actions;

export default appSlice.reducer;

// Selectori
export const selectApp = (state) => state.app;
export const allAppData = (state) => state.app;

/**
 * Stage selector za App.jsx "switchanje":
 * - loading dok bootstrap nije gotov
 * - pairing ako nije paired
 * - login ako je paired ali nije logiran
 * - sales ako je paired i logiran
 */
export const selectStage = (state) => {
  const status = state.app.status;
  const {token } = state.app.pairingData;
  const {user_username } = state.app.logedUser;
  console.log('STATUS JE:', status)
  //if (status !== "ready") return "loading";
  if (!token) return "pairing";
  if (!user_username && token) return "login";
  return "sales";
};
