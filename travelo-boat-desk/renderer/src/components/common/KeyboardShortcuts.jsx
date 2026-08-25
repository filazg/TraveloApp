import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";
import { FUNKCIJSKE_TIPKE } from "./shortcutActions";

// Sluša funkcijske tipke na prodajnom ekranu i upisuje signal koji komponente
// s odgovarajućim handlerom pokupe. Ne izvodi ništa sama — vidi shortcutActions.
export default function KeyboardShortcuts() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const shortcuts = appData.operatorSettings?.shortcuts || {};
    const username = appData.logedUser?.user_username;

    // Prečaci se učitaju za prijavljenog operatera. Drugi operater na istoj
    // blagajni dobiva svoje.
    useEffect(() => {
        if (!username) return;
        let otkazano = false;
        (async () => {
            try {
                const res = await window.api.app.getOperatorSettingsIPC(username);
                if (!otkazano && res?.ok) {
                    dispatch(setStateData({ path: "operatorSettings/shortcuts", value: res.data?.shortcuts || {} }));
                }
            } catch (e) {
                console.log("getOperatorSettingsIPC nije uspio:", e?.message || e);
            }
        })();
        return () => { otkazano = true; };
    }, [dispatch, username]);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (!FUNKCIJSKE_TIPKE.includes(e.key)) return;

            // F5 i F11 inače reloadaju odnosno prebacuju u cijeli zaslon. To se
            // gasi i kad tipka nije dodijeljena — na blagajni je slučajan reload
            // usred prodaje gori od tipke koja ne radi ništa.
            e.preventDefault();

            const akcija = shortcuts[e.key];
            if (!akcija) return;

            // Dok je otvoren dijalog, prečac bi radio "iza leđa" — npr. izdao
            // račun dok blagajnik upisuje kupca. Postavke prečaca se tako ne
            // mogu ni okinuti same na sebi.
            const otvorenDijalog = document.querySelector(".MuiDialog-root, .MuiModal-root");
            if (otvorenDijalog) return;

            dispatch(setStateData({
                path: "shortcutSignal",
                // Vrijeme i brojač: dva ista pritiska moraju dati dvije različite
                // vrijednosti, inače se useEffect drugi put ne okine.
                value: { action: akcija, ts: Date.now(), key: e.key },
            }));
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [dispatch, shortcuts]);

    return null;
}
