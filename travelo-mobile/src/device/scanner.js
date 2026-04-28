// Sunmi hardware scanner — koristi @linvix-sistemas/react-native-sunmi-broadcast-scanner.
// Paket bind-a IScanInterface AIDL servis u module konstruktoru, što drži aktivnu
// vezu sa com.sunmi.scanner servisom i sprječava start/stop lifecycle koji je u
// prijašnjoj implementaciji (pure broadcast) triggerio bridgeless RN reload.
import { Platform } from 'react-native';
import RNSunmiBroadcastScanner from '@linvix-sistemas/react-native-sunmi-broadcast-scanner';

const isAvailable = Platform.OS === 'android' && !!RNSunmiBroadcastScanner;

// Registriraj callback koji se poziva za svaki skenirani barkod/QR.
// Vraća objekt sa .remove() za cleanup.
export function onScan(callback) {
    if (!isAvailable) return { remove: () => {} };
    try {
        const sub = RNSunmiBroadcastScanner.onBarcodeRead((ev) => {
            try { callback(ev?.code || ''); } catch (e) { console.warn('[onScan] handler err:', e?.message || e); }
        });
        return sub;
    } catch (err) {
        console.warn('[onScan] subscribe failed:', err?.message || err);
        return { remove: () => {} };
    }
}

// Legacy kompatibilnost — svaki ekran koji je prije pozivao ovo, nek i dalje smije.
export function startScanner() { /* no-op — receiver se registrira u native module constructoru */ }
export function stopScanner() { /* no-op */ }

// Activity-based scanner (fallback) — otvara Sunmi camera QR scanner preko react-native-sunmi-inner-scanner.
// Koristi se ako korisnik klikne na "Skeniraj" gumb umjesto pritiska HW tipke.
import SunmiInnerScanner from 'react-native-sunmi-inner-scanner';
export async function scanOnce(options = {}) {
    if (Platform.OS !== 'android' || !SunmiInnerScanner) return null;
    try {
        const result = await SunmiInnerScanner.openScannerWithOptions({
            paySound: true,
            payVibrate: false,
            showSetting: false,
            showAlbum: false,
            ...options,
        });
        return result?.value || null;
    } catch (err) {
        console.log('[scanOnce] error:', err?.message || err);
        return null;
    }
}

export const sunmiScannerAvailable = isAvailable;
