import { useEffect, useState } from "react";
import { Backdrop, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { authSliceData } from "../auth/authSlice";

export  function LoadingView () {
const authData = useSelector(authSliceData)
const [deg,setDeg] = useState('60deg')

useEffect(() => {
    const timeoutId = setTimeout(() => {
      if(deg === '60deg'){
        setDeg('120deg')
      }else if(deg === '120deg'){
        setDeg('180deg')
      }else if(deg === '180deg'){
        setDeg('240deg')
      }else if(deg === '240deg'){
        setDeg('300deg')
      }else if(deg === '300deg'){
        setDeg('0deg')
      }else if(deg === '0deg'){
        setDeg('60deg')
      }
    }, 250);

  });

    return (
        <Backdrop 
          open={authData.loading}
          sx={{
            zIndex: (theme) => theme.zIndex.modal + 500,
            background:'#96D1F2'
          }}
          >
            <Stack >
                <Box  
                    sx={{rotate:deg}}
                    justifyContent="center"
                    alignItems="center"
                    >
                    <img
                      alt="loading"
                      width="80px"
                      height="80px"
                      src={`src/assets/TraveloAppIcon.png`}
                    />
                  </Box>
            </Stack>
        </Backdrop>
    )
}


export  function LoadingOverlay({ text = "Loading..." }) {
  const authData = useSelector(authSliceData)
  return (
    <Backdrop
      open={authData.loading}
      sx={{
        // Iznad modala (1300), ne iznad ladice (1200): storno, prebacivanje i
        // slanje e-maila pokreću se iz otvorenog prozora, pa se prekrivač na
        // nižem sloju crtao ispod njega i izgledalo je kao da ga nema.
        zIndex: (theme) => theme.zIndex.modal + 500,
        backdropFilter: "blur(3px)",
        backgroundColor: "rgba(150, 209, 242, 0.35)", // tvoja brand boja
      }}
    >
      <Box
        sx={{
          p: 4,
          borderRadius: 3,
          background: "white",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          minWidth: 180,
          boxShadow: 6,
        }}
      >
        <CircularProgress size={36} />
        <Typography variant="body1" fontWeight={500}>
          {authData.loadingMessage}
        </Typography>
      </Box>
    </Backdrop>
  );
}