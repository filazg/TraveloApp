import { Box, Stack } from "@mui/material";
import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import Topbar from "./Topbar";
import { authSliceData, setAuthData } from "../features/auth/authSlice";

export default function AppLayout() {
  const dispatch = useDispatch();
  const authData = useSelector(authSliceData);

  // Osvježi katalog modula pri učitavanju aplikacije, da padajući izbornik prati
  // promjene u konfiguraciji (modules_configs) bez potrebe za ponovnom prijavom.
  // Re-sinkroniziraj i trenutno odabrani modul (izvor sadržaja izbornika).
  useEffect(() => {
    let active = true;
    (async () => {
      if (!authData?.backendURL || !authData?.loggedUserData?.username) return;
      try {
        const api = axios.create({ baseURL: authData.backendURL, withCredentials: true });
        const resp = await api.get("/portal/system/modules");
        if (!active || resp.status !== 200 || !resp.data) return;
        const catalog = resp.data;
        const updates = [{ path: "modulesCatalog", value: catalog }];
        const curKey = authData?.selectedFeature?.key;
        if (curKey && Array.isArray(catalog.modules)) {
          const fresh = catalog.modules.find((m) => m.key === curKey);
          if (fresh) updates.push({ path: "selectedFeature", value: fresh });
        }
        dispatch(setAuthData({ updates }));
      } catch {
        // tiho — zadržava postojeći katalog iz sesije
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
