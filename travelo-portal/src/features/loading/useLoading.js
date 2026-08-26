import { useDispatch } from "react-redux";
import { setAuthData } from "../auth/authSlice";

// Globalni prekrivač s porukom — LoadingOverlay ga crta iz `auth.loading`.
// Svaka radnja koja traje dulje od trenutka mora ga podići: inače korisnik ne
// zna radi li se išta, pa klikne drugi put.
export function useLoading() {
    const dispatch = useDispatch();

    const pokazi = (poruka) => {
        dispatch(setAuthData({ path: "loadingMessage", value: poruka || "Molimo pričekajte" }));
        dispatch(setAuthData({ path: "loading", value: true }));
    };

    const sakrij = () => dispatch(setAuthData({ path: "loading", value: false }));

    // Pokriva i slučaj kad radnja pukne — bez `finally` prekrivač ostane visjeti
    // preko ekrana i aplikacija izgleda zamrznuto.
    const tijekom = async (poruka, radnja) => {
        pokazi(poruka);
        try {
            return await radnja();
        } finally {
            sakrij();
        }
    };

    return { pokazi, sakrij, tijekom };
}
