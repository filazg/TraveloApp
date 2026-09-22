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
    // Mobilna zaštita od vodoravnog "curenja" cijele stranice: korijen skriva
    // horizontalni preljev (nema scrollbara preko cijelog ekrana ni ispod
    // topbara), a sadržajni okvir dobiva overflowX:auto — ako neka široka tablica
    // ne stane, skrola se SAMO sadržaj (topbar ostaje), a sadržaj ostaje
    // dohvatljiv (bez rezanja). Stranice koje već imaju vlastiti scroll u tablici
    // (TableContainer / overflowX na gridu, npr. Brod → Linije) rade kao i prije.
    <Box sx={{ minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
      <Topbar />
      <Box sx={{ flex: 1, minWidth: 0, overflowX: "auto", px: { xs: 1, sm: 3 }, py: { xs: 1, sm: 3 } }}>
        <Stack alignItems="center" sx={{ width: "100%", minWidth: 0 }}>
          <Outlet />
        </Stack>
      </Box>
    </Box>
  );
}
