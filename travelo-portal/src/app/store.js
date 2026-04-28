import { configureStore } from "@reduxjs/toolkit";
import authReducer from "/src/features/auth/authSlice.js"
import backofficeReducer from "/src/features/backoffice/backofficeSlice.js"
import boatReducer from "/src/features/boat/boatSlice.js"
import financeReducer from "/src/features/finance/financeSlice.js"
import salesReducer from "/src/features/sales/salesSlice.js"
import dispatcherReducer from "/src/features/dispatcher/dispatcherSlice.js"
import bookingReducer from "/src/features/booking/bookingSlice.js"
import sailingReducer from "/src/features/sailing/sailingSlice.js"

export const store = configureStore({
  reducer: {
    auth:authReducer,
    backoffice:backofficeReducer,
    boat:boatReducer,
    finance:financeReducer,
    sales:salesReducer,
    dispatcher:dispatcherReducer,
    booking:bookingReducer,
    sailing:sailingReducer,
  },
});
