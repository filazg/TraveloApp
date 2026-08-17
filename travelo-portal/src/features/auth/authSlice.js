import { createSlice } from "@reduxjs/toolkit"

// Adresa backenda: VITE_BACKEND_URL ako je postavljena (test VM vrti SPA kao
// Vite dev server, pa se tamo prosljeđuje kroz pm2), inače build gađa testni
// poslužitelj a `npm run dev` lokalni. Ručna zastavica se znala zaboraviti.
const backendURL = import.meta.env.VITE_BACKEND_URL
    || (import.meta.env.PROD ? 'https://bookingtest.krilo.hr/app' : 'http://localhost:5100')

const initialState = {
    backendURL,
    selectedFeature:{},
    loggedUserData:{},
    loading:false,
    loadingMessage:'',
    selectedLanguage:{ code: "hr", label: "Hrvatski", short: "HR" },
    langs: [
        { code: "hr", label: "Hrvatski", short: "HR" },
        { code: "en", label: "English", short: "EN" },
    ],
    modulesCatalog: { modules: [], enabled_modules: [], env_modules: [] },
    modulesLoaded: false,
    transportmodulesData: [
         {
            acr: "TRAD",
            title: "BOAT",
            icon: "DirectionsBoat",
            path: "/boat",
            order: 20,
            color: '#175BD0',
            iconColor:'white',
            submenu: [
            {
                label: "Transport boat data",
                icon: "BusinessIcon",
                items: [
                { label: "Lines", path: "/boat/lines", icon: "ApartmentIcon" },
                { label: "Timetables", path: "/boat/timetables", icon: "StorefrontIcon" },
                { label: "Boats", path: "/boat/boats", icon: "DnsIcon" },
                { label: "Tickets Types", path: "/boat/tickets_types", icon: "PeopleAltIcon" },
                { label: "Harbors", path: "/boat/harbors", icon: "HandshakeIcon" },
                { label: "Port authorities", path: "/boat/regions", icon: "AnchorIcon" },
                ],
            },
            ],
        },{
            acr: "SALE",
            title: "POS",
            icon: "PointOfSale",
            path: "/sales",
            order: 20,
            color: '#175BD0',
            groups: [
            {
                label: "Basic Data",
                icon: "BusinessIcon",
                items: [
                { label: "Company Data", path: "/backoffice/company", icon: "ApartmentIcon" },
                { label: "Bussiness premisess", path: "/backoffice/business_premises", icon: "StorefrontIcon" },
                { label: "Terminals", path: "/backoffice/billing_devices", icon: "DnsIcon" },
                { label: "Users", path: "/backoffice/users", icon: "PeopleAltIcon" },
                { label: "Partners", path: "/backoffice/partners", icon: "HandshakeIcon" },
                ],
            },
            {
                label: "Settings",
                icon: "SettingsIcon",
                items: [
                { label: "Payment method", path: "/backoffice/payment_methods", icon: "PaymentsIcon" },
                { label: "Addressbook", path: "/backoffice/addressbook", icon: "ContactsIcon" },
                ],
            },
            ],
        },{
            acr: "DISP",
            title: "DISPATCHER",
            icon: "SupportAgent",
            path: "/dispatcher",
            order: 20,
            color: '#175BD0',
            iconColor:'white',
            submenu: [
            {
                label: "Dispečer",
                icon: "BusinessIcon",
                items: [
                { label: "Pregled polazaka", path: "/dispatcher", icon: "DnsIcon" },
                ],
            },
            ],
        },{
            acr: "KAPETAN",
            title: "KAPETAN",
            icon: "Sailing",
            path: "/sailing",
            order: 20,
            color: '#175BD0',
            iconColor:'white',
            submenu: [
            {
                label: "Kapetan",
                icon: "Sailing",
                items: [
                { label: "Plovidbe", path: "/sailing", icon: "DirectionsBoatIcon" },
                ],
            },
            ],
        }
    ],
    basicModulesData:[
        {
            acr: "BAOF",
            title: "ADMINISTRACIJA",
            icon: "AdminPanelSettings",
            path: "/backoffice",
            order: 30,
            color: '#EFBA3E',
            iconColor:'white',
            submenu: [
            {
                label: "Basic Data",
                icon: "BusinessIcon",
                items: [
                { label: "Company Data", path: "/backoffice/company", icon: "ApartmentIcon" },
                { label: "Bussiness premisess", path: "/backoffice/business_premises", icon: "StorefrontIcon" },
                { label: "Terminals", path: "/backoffice/billing_devices", icon: "DnsIcon" },
                { label: "Users", path: "/backoffice/users", icon: "PeopleAltIcon" },
                { label: "Partners", path: "/backoffice/partners", icon: "HandshakeIcon" },
                ],
            },
            {
                label: "Settings",
                icon: "SettingsIcon",
                items: [
                { label: "Payment method", path: "/backoffice/payment_methods", icon: "PaymentsIcon" },
                { label: "Addressbook", path: "/backoffice/addressbook", icon: "ContactsIcon" },
                ],
            },
            ],
        },
        {
            acr: "FINA",
            title: "FINANCIJE",
            icon: "AccountBalance",
            path: "/finance",
            order: 40,
            color: '#EFBA3E',
            iconColor:'white',
            submenu: [
            {
                label: "Finance",
                icon: "BusinessIcon",
                items: [
                { label: "Računi", path: "/backoffice/company", icon: "ApartmentIcon" },
                { label: "B2B Računi", path: "/backoffice/business_premises", icon: "StorefrontIcon" },
                { label: "Katrte", path: "/backoffice/billing_devices", icon: "DnsIcon" },
                ],
            },
            {
                label: "Izvještaji",
                icon: "SettingsIcon",
                items: [
                { label: "Lučke naknade", path: "/backoffice/payment_methods", icon: "PaymentsIcon" },
                { label: "Zaključci prometa", path: "/backoffice/addressbook", icon: "ContactsIcon" },
                { label: "ERP izvještaji", path: "/backoffice/addressbook", icon: "ContactsIcon" },
                ],
            },
            ],
        },
        {
            acr: "MANA",
            title: "MENAĐMENT",
            icon: "Insights",
            path: "/management",
            order: 40,
            color: '#EFBA3E',
            iconColor:'white',
            submenu: [
            {
                label: "Izvještaji prodaje",
                icon: "BusinessIcon",
                items: [
                { label: "Realizacija", path: "/management/monthly_sales_report", icon: "SummarizeIcon" },
                { label: "Prodaja", path: "/management/monthly_purchases_report", icon: "SummarizeIcon" }
                ],
            }
            ],
        }
    ]
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

const authSlice = createSlice({
    name:'auth',
    initialState,
    reducers:{
        setAuthData(state, action) {
            console.log('SET STATE DATA:', action.payload)
            const { path, value, updates } = action.payload || {}
            if (Array.isArray(updates)) {
                for (const u of updates) setDeep(state, u.path, u.value)
                return
            }
            setDeep(state, path, value)
        },
        resetAuthData(state, action) {
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
    }
})

export const {
    setAuthData,
    resetAuthData
} = authSlice.actions

export const authSliceData = (state) => state.auth

export default authSlice.reducer