import { useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

export default function RequireAuth() {
  const location = useLocation()
  const { user, bootChecked } = useSelector((s) => s.auth)

  if (!bootChecked) return null

  return user?.username
    ? <Outlet />
    : <Navigate to="/login" state={{ from: location }} replace />
}
