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
