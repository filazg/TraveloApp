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

 return (
  <>
    <InformationComponent />
    <SyncNotifications />
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
