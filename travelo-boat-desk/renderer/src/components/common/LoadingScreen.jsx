import { Backdrop, Box, CircularProgress, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { allAppData } from "../../store/appSlice";

export default function LoadingScreen() {
  const appData = useSelector(allAppData);
  return (
    <Backdrop open={appData.status !=='ready'}
        sx={{
        color: "#fff",
        zIndex: (theme) => theme.zIndex.modal + 1, // iznad MUI Modala
    }}
    >
      <Typography>{appData.loadingText}</Typography>
      <CircularProgress sx={{
          color: 'inherit',
      }} />
    </Backdrop>
  );
}
