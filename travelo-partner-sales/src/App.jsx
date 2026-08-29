import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { Navigate, Route, Routes } from 'react-router-dom'
import { checkSession } from './features/auth/authSlice'
import RequireAuth from './features/auth/RequireAuth'
import AppLayout from './layout/AppLayout'
import LoadingOverlay from './layout/LoadingOverlay'
import LoginPage from './pages/LoginPage'
import SearchPage from './pages/SearchPage'

export default function App() {
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(checkSession())
  }, [dispatch])

  return (
    <>
      {/* Stoji izvan ruta, da prekrije i dijaloge — rezervacija se potvrduje u
          dijalogu, a ondje se najvise ceka. */}
      <LoadingOverlay />
      <Routes>
        <Route path="login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/search" replace />} />
            <Route path="search" element={<SearchPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}
