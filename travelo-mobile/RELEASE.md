# Release build (Boat mobile)

## Potpisni ključ

Release se potpisuje ključem koji **nije u repou** — izgubi li se, objavljena
aplikacija se više ne može ažurirati na Play Storeu.

| | |
|---|---|
| Keystore | `C:\Tech4beeZ\Projekti\_keys\travelo-mobile\travelo-release.keystore` |
| Alias | `travelo-release` |
| Vrijedi do | 06.01.2054. |
| SHA-256 | `B2:D1:37:A3:C7:D0:CE:21:FE:77:05:D4:EF:77:BE:F0:71:B2:04:21:75:91:8B:8F:35:22:22:0E:7C:1A:A9:E8` |

Lozinke stoje u `%USERPROFILE%\.gradle\gradle.properties` (`TRAVELO_RELEASE_*`),
također izvan repoa. Datoteku keystorea i lozinke treba držati na sigurnom
mjestu izvan ovog računala.

Na drugom stroju treba prekopirati keystore i te četiri property vrijednosti.
Bez njih se release i dalje složi, ali **debug ključem** — Gradle to ispiše kao
upozorenje, a takav build store neće primiti.

## Build

```
cd travelo-mobile\android
.\gradlew.bat app:assembleRelease app:bundleRelease
```

Izlazi:

- `android\app\build\outputs\apk\release\travelo_app-v<verzija>.apk` — izravna
  instalacija na terminale
- `android\app\build\outputs\bundle\release\app-release.aab` — upload na Play
  Store

JS bundle je unutar buildova, pa Metro nije potreban za pokretanje.

Verzija se diže u `android/app/build.gradle` (`versionCode` + `versionName`);
Play Store odbija upload s `versionCode` koji je već korišten.

## Prije objave provjeriti

- `applicationId` je `hr.koris.roko` — privremeno posuđen zbog TapLinx ključa
  registriranog za taj paket. Pod tim ID-em aplikacija ne može ići na Play
  račun TraveloAppa; za objavu treba vlastiti TapLinx ključ i povratak na
  `com.travelomobile`.
- `usesCleartextTraffic` je `true` (potreban za HTTP backend u testiranju).
