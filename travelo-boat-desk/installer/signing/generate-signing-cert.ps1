<#
  Generira VLASTITI (self-signed) code-signing certifikat za potpisivanje deska.

  Izlaz:
    - travelo-desk-signing.pfx  → PRIVATNI ključ za potpis (koristi ga build,
                                   NIKAD u repo; čuva se kao mobilni keystore)
    - travelo-desk-signing.cer  → JAVNI dio (ide na svaku blagajnu u Trusted
                                   Root + Trusted Publisher preko install-cert-
                                   on-machine.ps1 ili GPO)

  Subject (CN) MORA se poklapati s "publisherName" u package.json build.win —
  inače electron-updater odbije provjeriti potpis nove verzije.

  Pokretanje (na stroju za build, jednokratno):
    powershell -ExecutionPolicy Bypass -File .\generate-signing-cert.ps1 -PfxPassword "TAJNA"

  Certifikat vrijedi 10 godina. Kad istekne, generiraj novi i ponovno raspodijeli
  .cer floti PRIJE nego objaviš verziju potpisanu novim certom.
#>
param(
  [string]$Subject = "CN=Tech4beeZ d.o.o.",
  [Parameter(Mandatory = $true)][string]$PfxPassword,
  [string]$OutDir
)

$ErrorActionPreference = "Stop"

# $PSScriptRoot zna ispasti prazan (ovisno o tome kako je skripta pozvana), a
# tada se "$PSScriptRoot\_out" razrijesi u "\_out" — korijen diska. Cert je
# tako zavrsio u C:\_out umjesto uz skriptu, a build ga ondje ne trazi.
if (-not $OutDir) {
  $korijen = if ($PSScriptRoot) { $PSScriptRoot }
             elseif ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path }
             else { (Get-Location).Path }
  $OutDir = Join-Path $korijen '_out'
}
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Write-Host "Izlazni direktorij: $OutDir"

Write-Host "Generiram self-signed code-signing certifikat: $Subject"
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $Subject `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -NotAfter (Get-Date).AddYears(10)

$pfxPath = Join-Path $OutDir "travelo-desk-signing.pfx"
$cerPath = Join-Path $OutDir "travelo-desk-signing.cer"

$securePwd = ConvertTo-SecureString -String $PfxPassword -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePwd | Out-Null
Export-Certificate  -Cert $cert -FilePath $cerPath | Out-Null

# Ukloni iz osobnog storea da privatni ključ ne visi na build stroju bez potrebe.
Remove-Item -Path ("Cert:\CurrentUser\My\" + $cert.Thumbprint) -Force

Write-Host ""
Write-Host "Gotovo:" -ForegroundColor Green
Write-Host "  PFX (privatno, za build):  $pfxPath"
Write-Host "  CER (javno, za flotu):     $cerPath"
Write-Host "  Thumbprint:                $($cert.Thumbprint)"
Write-Host ""
Write-Host "Build potpisivanje (prije 'npm run package'):"
Write-Host "  `$env:CSC_LINK = '$pfxPath'"
Write-Host "  `$env:CSC_KEY_PASSWORD = '<lozinka>'"
