import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, CircularProgress } from "@mui/material";

import { allAppData, bootstrapApp, pairedSet, selectStage, setStateData } from "./store/appSlice";
import PairingScreen from "./screens/PairingScrean";
import LoginScreen from "./screens/LoginScrean";
import SalesScreen from "./screens/SalesScrean";
import LoadingScreen from "./components/common/LoadingScreen";
import InformationComponent from "./components/common/InvormationComponent";
import SyncNotifications from "./components/common/SyncNotifications";
import UpdateNotice from "./components/common/UpdateNotice";
import SessionExpiredDialog from "./components/common/SessionExpiredDialog";



export default function App() {
  const dispatch = useDispatch();
  const stage = useSelector(selectStage);
  const appData = useSelector(allAppData);

  const getData = async () => {
    try {
      const getpairingData = await window.api.app.getPairingData()
      const basicData = await window.api.app.getLocalBasicDataIpc()
      if(getpairingData.data.pairing?.token){
        await dispatch(setStateData({path:'pairingData', value: getpairingData.data.pairing}));
        await dispatch(setStateData({path:'basicData', value: basicData.data}));
      }
    console.log("GET PAIRING DATA IZ APP:", getpairingData.data.pairing);

    } catch (error) {
      console.error("ERROR GETTING PAIRING DATA:", error); 
    }
  }

  useEffect(() => {
    getData();
    dispatch(bootstrapApp());
  }, [dispatch]);

  // Tiha obnova access tokena zivi u glavnom procesu. Kad ni ona ne uspije
  // (nema/istekao refresh token), glavni proces javi 'app:sessionExpired'.
  // Operater se vise NE odjavljuje i token se ne brise — inace bi blagajna pala
  // na uparivanje i trazila TID. Prozor SessionExpiredDialog trazi samo novi OTP
  // za isti TID, a rad lokalno ide dalje.

  // Glavni proces treba znati na kojem smo ekranu — automatski update se
  // instalira/ponovno pokreće samo dok NISMO u prodaji (login/pairing), da se
  // nikad ne prekine rad blagajnika.
  useEffect(() => {
    window?.api?.app?.reportStage?.(stage);
  }, [stage]);

 return (
  <>
    <InformationComponent />
    <SyncNotifications />
    <UpdateNotice />
    <SessionExpiredDialog />
    {(() => {
      switch (stage) {
        case "pairing":
          return <PairingScreen />;
        case "login":
          return <LoginScreen />;
        case "sales":
          return <SalesScreen />;
        default:
          return (
            <Box sx={{ height: "100vh", display: "grid", placeItems: "center" }}>
              <CircularProgress />
            </Box>
          );
      }
    })()}
  </>
);
}
