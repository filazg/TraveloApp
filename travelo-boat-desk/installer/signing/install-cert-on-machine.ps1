<#
  Ubacuje JAVNI dio našeg code-signing certifikata (travelo-desk-signing.cer) u
  Trusted Root i Trusted Publisher LOKALNOG STROJA. Nakon toga Windows/Defender/
  SmartScreen vjeruju našem potpisu, pa desk instalacija i automatska ažuriranja
  ne dižu upozorenje NA TOM STROJU.

  Pokreni JEDNOM po blagajni, KAO ADMINISTRATOR (ili preko GPO-a na cijelu flotu):
    powershell -ExecutionPolicy Bypass -File .\install-cert-on-machine.ps1

  Bez -CerPath uzima 'travelo-desk-signing.cer' pored ove skripte — tako je zove
  i installer (customInstall), bez prosljeđivanja putanje kroz navodnike (to je
  ranije lomilo Mandatory -CerPath, skripta bi pala s exit 1 i cert ne bi ušao).

  VAŽNO: ovo je preduvjet i za automatsko ažuriranje — electron-updater provjerava
  potpis preuzete verzije (Get-AuthenticodeSignature). Bez povjerenja u cert,
  provjera padne i update se ne primijeni.
#>
param(
  [string]$CerPath
)

$ErrorActionPreference = "Stop"

# Trag za dijagnostiku (installer korak je bešuman, pa bez ovoga ne bi bilo
# vidljivo zašto sadnja nije prošla).
$log = Join-Path $env:TEMP "travelo-cert-install.log"
function Zapis($m) { try { "$(Get-Date -Format o)  $m" | Out-File -FilePath $log -Append -Encoding utf8 } catch {} }

# Ako putanja nije dana, uzmi cert pored ove skripte.
if (-not $CerPath -or $CerPath.Trim() -eq "") {
  $CerPath = Join-Path $PSScriptRoot "travelo-desk-signing.cer"
}
Zapis "start CerPath=$CerPath"

# Provjera admin ovlasti — import u LocalMachine store to zahtijeva.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Zapis "NIJE admin — prekid"
  Write-Error "Pokreni kao Administrator (import u LocalMachine store)."
  exit 1
}

if (-not (Test-Path $CerPath)) {
  Zapis "cert ne postoji: $CerPath"
  Write-Error "Ne nalazim certifikat: $CerPath"
  exit 1
}

try {
  Write-Host "Uvozim u Trusted Root (LocalMachine\Root)…"
  Import-Certificate -FilePath $CerPath -CertStoreLocation "Cert:\LocalMachine\Root" | Out-Null

  Write-Host "Uvozim u Trusted Publisher (LocalMachine\TrustedPublisher)…"
  Import-Certificate -FilePath $CerPath -CertStoreLocation "Cert:\LocalMachine\TrustedPublisher" | Out-Null

  Zapis "OK — cert posađen"
  Write-Host "Gotovo — stroj sada vjeruje TraveloAPP potpisu." -ForegroundColor Green
} catch {
  Zapis "IMPORT FAIL: $($_.Exception.Message)"
  Write-Error $_.Exception.Message
  exit 1
}
