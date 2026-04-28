// Wrapper oko native AkdCard modula (Tessera AAR + NXP TapLinx).
// Smije se zvati samo na Androidu — na iOS-u/web-u tih modula nema.
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const AkdCard = NativeModules.AkdCard;
const emitter = AkdCard ? new NativeEventEmitter(AkdCard) : null;

export const akdCardAvailable = Platform.OS === 'android' && !!AkdCard;
console.log('[AkdCard] module loaded — available =', akdCardAvailable, 'native =', !!AkdCard);

// Uključi NFC foreground dispatch — pozovi prilikom ulaska u modal za skeniranje.
export async function startScan() {
    if (!akdCardAvailable) throw new Error('AKD NFC modul nije dostupan');
    return AkdCard.startScan();
}

// Isključi NFC foreground dispatch — pozovi pri zatvaranju modal-a.
export async function stopScan() {
    if (!akdCardAvailable) return false;
    return AkdCard.stopScan();
}

// Subscribe na "akdCardRead" event. handler dobiva objekat:
//   { cardFamily: 'SEOP_P'|'SEOP_V'|'MOSI', cardNumber, firstName, surname, oib, islandName, basicRight }
//   ili { error: '...' }
export function onCardRead(handler) {
    if (!emitter) return () => {};
    const sub = emitter.addListener('akdCardRead', handler);
    return () => sub.remove();
}

// Native hideSoftInputFromWindow + clearFocus — pouzdaniji od RN Keyboard.dismiss()
// kad je TextInput unutar Modal-a koji se odmah unmounta.
export async function hideKeyboard() {
    if (!akdCardAvailable) return false;
    try { return await AkdCard.hideKeyboard(); } catch { return false; }
}
