import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";

const Layout = () => {
    return (
        <Box
        component="main"
        sx={{
            minHeight: "100vh",
            width: "100%"
        }}
        >
            <Outlet />
        </Box>
        
    )
}

export default Layout