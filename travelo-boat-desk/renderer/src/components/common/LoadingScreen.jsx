import { Backdrop, Box, CircularProgress, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { allAppData } from "../../store/appSlice";

export default function LoadingScreen() {
  const appData = useSelector(allAppData);
  return (
    <Backdrop open={appData.status !=='ready'}
        sx={{
        color: "#fff",
        // Iznad SVIH prozora, ne samo osnovnog modala: storno, pregled računa,
        // popis karata i zaključak smjene stoje na modal+10, pa se prekrivač s
        // modal+1 crtao ispod njih — radnja bi trajala, a ekran izgledao mrtav.
        zIndex: (theme) => theme.zIndex.modal + 500,
    }}
    >
      <Typography>{appData.loadingText}</Typography>
      <CircularProgress sx={{
          color: 'inherit',
      }} />
    </Backdrop>
  );
}
