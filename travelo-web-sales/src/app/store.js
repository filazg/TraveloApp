import { configureStore } from "@reduxjs/toolkit"
import webSalesReducer from "../pages/webSalesSlice"

export const store = configureStore({
  reducer: {
    webSales: webSalesReducer
  }
})