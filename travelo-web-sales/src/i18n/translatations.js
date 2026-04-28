import hr from "./languages/hr.json";
import en from "./languages/en.json";

export const translations = { hr, en };
export const FALLBACK_LANG = "hr";

const resolveKey = (bag, parts) => {
  let cur = bag;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

const interpolate = (tpl, vars) => {
  if (typeof tpl !== "string" || !vars) return tpl;
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`
  );
};

// Resolve a dotted key against the chosen language, falling back to
// the fallback language and ultimately returning the key so missing
// translations stay visible during dev.
//   translate("hr", "summary.pay", { amount: "12,00" })
//   translate("en", "search.title_empty")
export function translate(lang, key, vars) {
  if (!key) return "";
  const parts = String(key).split(".");
  const primary = resolveKey(translations[lang], parts);
  if (primary !== undefined && primary !== null) return interpolate(primary, vars);
  const fallback = resolveKey(translations[FALLBACK_LANG], parts);
  if (fallback !== undefined && fallback !== null) return interpolate(fallback, vars);
  return key;
}
