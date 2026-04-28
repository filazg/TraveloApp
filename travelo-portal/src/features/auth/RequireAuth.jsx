import { useSelector } from "react-redux";
import { useLocation, Navigate, Outlet } from "react-router-dom";
import { authSliceData } from "./authSlice";


const RequireAuth = () => {
  const location = useLocation()
  const authData = useSelector(authSliceData)
    
  return (
    authData.loggedUserData?.username 
        ? <Outlet/>
        : <Navigate to="/login" state={{from: location}} replace />
  )
}

export default RequireAuth
