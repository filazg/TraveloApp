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

## 2. Povjerenje u cert — automatski pri prvoj instalaciji

Cert se **ne mora** ručno raspoređivati: ako `travelo-desk-signing.cer` uđe u
build (korak 3), installer ga pri **prvoj, ručnoj** instalaciji sam ubaci u
Trusted Root + Trusted Publisher (`installer.nsh` → `customInstall`). To traži
**jedan UAC upit** pri toj prvoj instalaciji; nakon toga:

- sve buduće instalacije i **tihi auto-updateovi** prolaze bešumno (UAC se pri
  ažuriranju NE pojavljuje — silent install se preskače),
- ponovljena ručna instalacija ne gnjavi (preskače se ako je cert već povjerljiv).

App se i dalje instalira **per-user** (bez elevacije cijele instalacije) — eleviramo
samo korak s certom.

> Napomena: baš prva instalacija svejedno pokaže SmartScreen „Run anyway" jer cert
> u tom trenutku još nije posađen. Klikneš jednom i dalje je čisto.

**Alternativa (GPO / bez diranja installera):** `.cer` možeš raspodijeliti i
zasebno, kao Administrator (ili GPO-om), pa installer nema što raditi:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-cert-on-machine.ps1 -CerPath .\travelo-desk-signing.cer
```

## 3. Build potpisane verzije

Prvo kopiraj **javni** cert tamo gdje ga build pakira:

```powershell
copy .\_out\travelo-desk-signing.cer .\dist-cert\travelo-desk-signing.cer
```

Zatim postavi env varijable za potpis (electron-builder tad automatski potpisuje):

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

- **Prvi install** na novoj blagajni pokaže SmartScreen „Run anyway" (cert još
  nije posađen) i jedan UAC (za posaditi cert). Nakon toga je sve bešumno —
  instalacije i auto-updateovi.
- Ako korisnik odbije UAC pri prvoj instalaciji, app se svejedno instalira; samo
  cert ne uđe u trust store, pa se ponaša kao danas (SmartScreen upozorenja).
  Cert se onda može naknadno posaditi korakom 2 (alternativa).
- Dev build / build bez `dist-cert/travelo-desk-signing.cer` preskače korak s
  certom.
- Dev build (`app.isPackaged === false`) preskače i provjeru update-a.
- Ako verzija na feedu nije viša od instalirane, ništa se ne događa.
