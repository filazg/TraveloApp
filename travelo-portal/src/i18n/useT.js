import { useSelector } from "react-redux";
import { authSliceData } from "../features/auth/authSlice";
import { translate } from "./translatations";

export function useT() {
  const authData = useSelector(authSliceData);
    const lang = authData.selectedLanguage?.code

  const t = (key) => translate(lang, key);

  return { t, lang };
}
