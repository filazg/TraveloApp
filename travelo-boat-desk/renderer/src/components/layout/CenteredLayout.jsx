import { Stack } from "@mui/material";

export default function CenteredLayout({ children }) {
  return (
    <Stack sx={{ height: "100vh" }} alignItems="center" justifyContent="center">
      {children}
    </Stack>
  );
}