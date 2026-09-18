<#
  Ubacuje JAVNI dio našeg code-signing certifikata (travelo-desk-signing.cer) u
  Trusted Root i Trusted Publisher LOKALNOG STROJA. Nakon toga Windows/Defender/
  SmartScreen vjeruju našem potpisu, pa desk instalacija i automatska ažuriranja
  ne dižu upozorenje NA TOM STROJU.

  Pokreni JEDNOM po blagajni, KAO ADMINISTRATOR (ili preko GPO-a na cijelu flotu):
    powershell -ExecutionPolicy Bypass -File .\install-cert-on-machine.ps1 -CerPath .\_out\travelo-desk-signing.cer

  VAŽNO: ovo je preduvjet i za automatsko ažuriranje — electron-updater provjerava
  potpis preuzete verzije (Get-AuthenticodeSignature). Bez povjerenja u cert,
  provjera padne i update se ne primijeni.
#>
param(
  [Parameter(Mandatory = $true)][string]$CerPath
)

$ErrorActionPreference = "Stop"

# Provjera admin ovlasti — import u LocalMachine store to zahtijeva.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Error "Pokreni kao Administrator (import u LocalMachine store)."
  exit 1
}

if (-not (Test-Path $CerPath)) {
  Write-Error "Ne nalazim certifikat: $CerPath"
  exit 1
}

Write-Host "Uvozim u Trusted Root (LocalMachine\Root)…"
Import-Certificate -FilePath $CerPath -CertStoreLocation "Cert:\LocalMachine\Root" | Out-Null

Write-Host "Uvozim u Trusted Publisher (LocalMachine\TrustedPublisher)…"
Import-Certificate -FilePath $CerPath -CertStoreLocation "Cert:\LocalMachine\TrustedPublisher" | Out-Null

Write-Host "Gotovo — stroj sada vjeruje TraveloAPP potpisu." -ForegroundColor Green
