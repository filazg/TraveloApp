import hr from "./languages/hr.json";
import en from "./languages/en.json";

export const translations = { hr, en };

export function translate(lang, key) {
  const parts = key.split(".");
  let v = translations[lang];

  for (const p of parts) v = v?.[p];

  return typeof v === "string" ? v : key;
}