import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { translate, translations } from "./translatations";
import { setWebSalesData, webSalesDataSlice } from "../pages/webSalesSlice";

const availableLangs = Object.keys(translations);

export function useT() {
  const dispatch = useDispatch();
  const webSalesData = useSelector(webSalesDataSlice);
  const lang = webSalesData.selectedLanguage?.code || "hr";

  const t = useCallback(
    (key, vars) => translate(lang, key, vars),
    [lang]
  );

  const setLang = useCallback(
    (code) => {
      const match = webSalesData.langs?.find((l) => l.code === code);
      if (match) dispatch(setWebSalesData({ path: "selectedLanguage", value: match }));
    },
    [dispatch, webSalesData.langs]
  );

  return useMemo(() => ({ t, lang, setLang, availableLangs }), [t, lang, setLang]);
}
