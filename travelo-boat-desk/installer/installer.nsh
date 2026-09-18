; Spašavanje podataka blagajne pri nadogradnji.
;
; Do verzije 1.0.20 baza (travelo.sqlite) i brojač EFTPOS sekvence (seq.json)
; završavali su u instalacijskom direktoriju, jer ih je aplikacija otvarala
; relativnom putanjom. Nadogradnja taj direktorij očisti, pa je svaka nova
; verzija odnosila račune, smjene i fiskalne brojače.
;
; Od 1.0.21 aplikacija radi s userData, ali to samo po sebi ne spašava zatečene
; instalacije — instalater obriše datoteke prije nego se nova verzija uopće
; pokrene. Zato se preslože ovdje, prije uninstallera stare verzije.
;
; Kopira se samo ako u userData još nema te datoteke, da se svježiji podaci ne
; pregaze starijom kopijom.

!macro customInit
  ${If} ${FileExists} "$INSTDIR\travelo.sqlite"
    ${IfNot} ${FileExists} "$APPDATA\travelo-boat-desk\travelo.sqlite"
      CreateDirectory "$APPDATA\travelo-boat-desk"
      CopyFiles /SILENT "$INSTDIR\travelo.sqlite" "$APPDATA\travelo-boat-desk\travelo.sqlite"
      DetailPrint "Baza blagajne preseljena u $APPDATA\travelo-boat-desk"
    ${EndIf}
  ${EndIf}

  ${If} ${FileExists} "$INSTDIR\seq.json"
    ${IfNot} ${FileExists} "$APPDATA\travelo-boat-desk\seq.json"
      CreateDirectory "$APPDATA\travelo-boat-desk"
      CopyFiles /SILENT "$INSTDIR\seq.json" "$APPDATA\travelo-boat-desk\seq.json"
      DetailPrint "Brojac EFTPOS sekvence preseljen u $APPDATA\travelo-boat-desk"
    ${EndIf}
  ${EndIf}
!macroend

; Automatsko povjerenje u TraveloAPP potpis.
;
; U release buildu je u resources\cert priložen javni .cer. Pri PRVOJ, ručnoj
; instalaciji ga posadimo u Trusted Root + Trusted Publisher — jedan UAC upit —
; pa Windows/Defender/SmartScreen od tada vjeruju našem potpisu, a sve buduće
; instalacije i (tihi) auto-updateovi prolaze bešumno.
;
; Aplikacija se instalira per-user (bez elevacije); eleviramo SAMO ovaj korak
; preko ExecShell "runas". Preskačemo ga:
;   - kod TIHE instalacije (${Silent}) — auto-update ide s /S, pa se pri
;     ažuriranju UAC NIKAD ne pojavljuje;
;   - ako je cert već povjerljiv — da ponovljena ručna instalacija ne gnjavi.
!macro customInstall
  ${If} ${FileExists} "$INSTDIR\resources\cert\travelo-desk-signing.cer"
  ${AndIfNot} ${Silent}
    ; Nezavisno (bez admina) provjeri je li cert već u Trusted Rootu.
    ; exit 0 = već postoji (preskoči), exit 3 = nema ga (posadi).
    ; $$_ jer NSIS inace $_ tumaci kao svoju (nepoznatu) varijablu i puca compile.
    nsExec::ExecToStack 'powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-ChildItem Cert:\LocalMachine\Root -ErrorAction SilentlyContinue | Where-Object { $$_.Subject -like ''*Tech4beeZ*'' }) { exit 0 } else { exit 3 }"'
    Pop $0
    ${If} $0 != 0
      DetailPrint "Ubacujem TraveloAPP certifikat u Trusted Root (potvrdite administratorski upit)…"
      ; Import radimo INLINE preko -Command (NE preko -File skripte): prosljedivanje
      ; -File "putanja" (pa i -CerPath) kroz ExecShell "runas" se u praksi znalo NE
      ; prenijeti, skripta se ne pokrene i cert ne ude. Inline -Command s putanjom
      ; koju NSIS sam ubaci ($INSTDIR) je pouzdano. install-cert-on-machine.ps1
      ; ostaje za rucni/GPO put.
      ExecShell "runas" "powershell.exe" "-NoProfile -ExecutionPolicy Bypass -Command Import-Certificate -FilePath '$INSTDIR\resources\cert\travelo-desk-signing.cer' -CertStoreLocation Cert:\LocalMachine\Root; Import-Certificate -FilePath '$INSTDIR\resources\cert\travelo-desk-signing.cer' -CertStoreLocation Cert:\LocalMachine\TrustedPublisher" SW_HIDE
    ${EndIf}
  ${EndIf}
!macroend
