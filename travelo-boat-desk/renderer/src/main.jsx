import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import {  CssBaseline } from "@mui/material";

import { store } from "./store";
import App from "./App";
import AppThemeProvider from "./theme/AppThemeProvider";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <AppThemeProvider>
        <CssBaseline />
        <App />
      </AppThemeProvider>
    </Provider>
  </React.StrictMode>
);