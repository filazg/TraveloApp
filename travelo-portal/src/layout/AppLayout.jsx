import { Box, Stack } from "@mui/material";
import { Outlet } from "react-router-dom";
import Topbar from "./Topbar";

export default function AppLayout() {
  return (
    <Box sx={{ minHeight: "100vh",  width: "100%", display: "flex", flexDirection: "column" }}>
      <Topbar />
      <Box sx={{ flex: 1, p: 3 }}>
        <Stack
          alignItems="center"
        >
          <Outlet />
        </Stack>
      </Box>
    </Box>
  );
}
