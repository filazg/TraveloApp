# Potpisivanje deska + automatsko ažuriranje

Dvije stvari koje idu zajedno:

1. **Potpis** — da Windows Defender/SmartScreen ne dižu upozorenje.
2. **Auto-update** — nova verzija se sama preuzme i instalira (kod prijave).

Odabrana ruta potpisa: **vlastiti (self-signed) certifikat + Trusted Root na
blagajnama**. Besplatno, ali vrijedi **samo na strojevima gdje smo ubacili naš
`.cer` u Trusted Root** (tj. našoj floti). Nije za javnu distribuciju.

---

## 1. Jednokratno — generiraj certifikat (na build stroju)

```powershell
cd travelo-boat-desk\installer\signing
powershell -ExecutionPolicy Bypass -File .\generate-signing-cert.ps1 -PfxPassword "IZABERI-TAJNU"
```

Nastane `_out\travelo-desk-signing.pfx` (privatno) i `_out\travelo-desk-signing.cer`
(javno). `_out/`, `*.pfx`, `*.cer` su u `.gitignore` — **ne idu u repo**. PFX i
lozinku čuvaj kao mobilni release keystore.

CN certifikata (`Tech4beeZ d.o.o.`) mora se poklapati s `build.win.publisherName`
u `package.json`. Ako mijenjaš CN, promijeni i publisherName.

## 2. Jednokratno po blagajni — povjerenje u cert

Kopiraj `travelo-desk-signing.cer` na svaku blagajnu i pokreni **kao Administrator**
(ili raspodijeli GPO-om na cijelu flotu):

```powershell
powershell -ExecutionPolicy Bypass -File .\install-cert-on-machine.ps1 -CerPath .\travelo-desk-signing.cer
```

Ovo je preduvjet i za auto-update: electron-updater provjerava potpis preuzete
verzije, a provjera prolazi samo ako stroj vjeruje certu.

## 3. Build potpisane verzije

electron-builder automatski potpisuje kad su postavljene env varijable:

```powershell
$env:CSC_LINK = "C:\putanja\do\travelo-desk-signing.pfx"
$env:CSC_KEY_PASSWORD = "IZABERI-TAJNU"
npm run package
```

(Bez tih varijabli build prolazi, ali NEPOTPISAN — dobar samo za lokalni test.)

Rezultat je u `dist/`:
- `Travelo Boat Desk Setup <verzija>.exe`
- `Travelo Boat Desk Setup <verzija>.exe.blockmap`
- `latest.yml`  ← manifest koji čita auto-update

## 4. Objava nove verzije (feed na VM-u)

Feed je generic provider: `https://bookingtest.krilo.hr/desk-updates/`
(vidi `build.publish` u `package.json`).

1. Digni `version` u `package.json` (npr. 1.0.26 → 1.0.27) i tek onda buildaj.
2. Prekopiraj iz `dist/` na VM u mapu koju nginx servira pod `/desk-updates/`:
   - `latest.yml`
   - `Travelo Boat Desk Setup <verzija>.exe`
   - `...exe.blockmap`

Primjer nginx lokacije (na VM-u, unutar server bloka za bookingtest.krilo.hr):

```nginx
location /desk-updates/ {
    alias /opt/TraveloApp/desk-updates/;
    autoindex off;
}
```

Nakon što datoteke stoje na feedu, svaka instalirana blagajna kod sljedeće
prijave (ili pokretanja) primijeti novu verziju, preuzme je u pozadini i
instalira + ponovno se pokrene **dok je na prijavnom ekranu** — bez prekidanja
prodaje. Vidi `electron/services/updateService.cjs`.

## Napomene

- **Prvi install** na novoj blagajni i dalje traži da je `.cer` već u Trusted
  Rootu (korak 2); inače prvi `.exe` dobije SmartScreen upozorenje. Auto-update
  nakon toga je bešuman.
- Dev build (`app.isPackaged === false`) preskače provjeru update-a.
- Ako verzija na feedu nije viša od instalirane, ništa se ne događa.
