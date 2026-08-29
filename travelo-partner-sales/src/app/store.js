import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import financeReducer from '../features/finance/financeSlice'
import salesReducer from '../features/sales/salesSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    sales: salesReducer,
    finance: financeReducer,
  },
})
