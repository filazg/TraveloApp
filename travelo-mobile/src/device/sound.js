// Validacijski zvučni signali — native ToneGenerator preko AppSound bridge-a.
// Bez asset fajlova, bez vanjskih dependencies — radi pouzdano na Sunmi V2s.
//
//   playSuccess() — kratki afirmativni ton (uspješna validacija)
//   playPrompt()  — dvostruki kratki beep (treba korisnik odlučiti)
//   playError()   — niski produženi ton (neuspjeh, nevažeća karta)
import { NativeModules, Platform } from 'react-native';

const { AppSound } = NativeModules;
const isAvailable = Platform.OS === 'android' && !!AppSound;

const safe = (fn) => (...args) => {
    if (!isAvailable) return Promise.resolve(false);
    try {
        return fn(...args).catch((e) => {
            console.warn('[sound]', e?.message || e);
            return false;
        });
    } catch (e) {
        console.warn('[sound]', e?.message || e);
        return Promise.resolve(false);
    }
};

export const playSuccess = safe(() => AppSound.playSuccess());
export const playPrompt  = safe(() => AppSound.playPrompt());
export const playError   = safe(() => AppSound.playError());
