# Travelo Mobile (React Native CLI)

POS + validacija karata za Sunmi V2s uređaj (ugrađeni printer + HW QR scanner).

## Trenutni opseg (Stage 1)
- Uparivanje uređaja (TID + OTP → token, sprema se u AsyncStorage)
- Sinkronizacija `basic_data` (poslovni prostor, naplatni uređaj, operateri, načini plaćanja)
- Prijava operatera (username/password match prema sinkroniziranim korisnicima)
- Home placeholder s tile-ovima za Prodaju i Validaciju

## Pokretanje

```bash
# iz korijena travelo-mobile/
npm start            # Metro bundler
# u drugom terminalu:
npm run android      # build i pokreni na uređaju/emulatoru
```

Za stvarni Sunmi V2s:
- USB debugging uključen, uređaj priključen (adb devices pokazuje ga)
- `npm run android` instalira APK i pokreće aplikaciju

Za Android emulator (testiranje bez fizičkog uređaja):
- Gateway URL koristi `http://10.0.2.2:5100` (umjesto `192.168.0.100:5100`)

## Arhitektura

```
src/
├── api/
│   ├── config.js          # gateway URL + endpoint putanje
│   └── client.js          # axios + AsyncStorage token
├── store/
│   ├── store.js
│   └── slices/
│       ├── authSlice.js   # pairing, restore tokena, operater
│       └── syncSlice.js   # basic_data sync
├── screens/
│   ├── PairingScreen.js
│   ├── OperatorLoginScreen.js
│   └── HomeScreen.js
├── navigation/
│   └── AppNavigator.js    # gating flow
└── device/
    ├── scanner.js         # Sunmi HW scanner wrapper
    └── printer.js         # Sunmi printer stub (Stage 2+)
```

## Flow
1. App start → restore tokena iz AsyncStorage
2. Nema token → **PairingScreen** → `POST /terminal_auth/login/terminalLogin`
3. Token OK → automatski `syncBasicDataThunk` → `GET /terminals/terminal/basic_data`
4. Token + sync + nema operatera → **OperatorLoginScreen** (match po users)
5. Operator OK → **HomeScreen**

## Backend endpointi (gateway :5100)
- `POST /terminal_auth/login/terminalLogin` — pairing (`{tid, otp}` → `{token}`)
- `GET /terminals/terminal/basic_data` — sync (Authorization: Bearer <token>)
- `GET /terminals/terminal/transport_data` — rute/linije (Stage 2)
- `POST /terminals/terminal/add_invoices` — slanje izdanih računa (Stage 2)

## Sunmi V2s integracije

### HW QR/barcode scanner
Native Kotlin bridge u `android/app/src/main/java/com/travelomobile/sunmi/`:
- `SunmiScannerModule.kt` registrira BroadcastReceiver na action
  `com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED` i emitira event `SunmiScan` u JS
- `SunmiScannerPackage.kt` registriran u `MainApplication.kt`

JS API (`src/device/scanner.js`):
```js
import { startScanner, stopScanner, onScan } from './device/scanner';

useEffect(() => {
    startScanner();
    const sub = onScan((code) => {
        console.log('skeniran:', code);
        // validiraj karticu...
    });
    return () => { sub.remove(); stopScanner(); };
}, []);
```

### Printer (Stage 2+)
Stub `src/device/printer.js`. Dodat će se kasnije preko `sunmi-printer-library` ili custom AIDL bridge-a na `woyou.aidlservice.jiuiv5.IWoyouService`.

## Sljedeći koraci
- [ ] Validation screen (QR scan → provjera karte)
- [ ] Sale screen (odabir linije/polaska/etape + print + izdavanje)
- [ ] transport_data sync (linije, luke, timetables, cjenik)
- [ ] Offline queue za prodaje bez veze
- [ ] Printer native integracija
