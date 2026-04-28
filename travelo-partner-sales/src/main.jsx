import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { CssBaseline } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import 'dayjs/locale/hr'
import { store } from './app/store'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="hr">
          <CssBaseline />
          <App />
        </LocalizationProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>
)
