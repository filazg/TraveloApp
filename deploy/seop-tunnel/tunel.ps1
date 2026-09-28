# Obrnuti SSH tunel ured -> VM: SEOP promet (seop.akd.hr:9444) izlazi kroz
# hrvatsku mrezu jer AKD ne pusta strane IP-ove. Na VM-u /etc/hosts ima
# 127.0.0.1 seop.akd.hr, pa akd-service ne zna da ide kroz tunel.
#
# Lokacija na uredskom racunalu: C:\ProgramData\Travelo\seop-tunnel\tunel.ps1
# Pokrece ga zadatak "Travelo SEOP tunel" (SYSTEM, ONSTART) - vidi README.md.

$dir = 'C:\ProgramData\Travelo\seop-tunnel'
$k   = "$dir\id_ed25519"
$h   = "$dir\known_hosts"
$log = "$dir\tunel.log"

while ($true) {
    "$(Get-Date -Format s)  spajanje" | Add-Content $log
    & ssh -N -R 127.0.0.1:9444:seop.akd.hr:9444 -i $k `
        -o UserKnownHostsFile=$h -o StrictHostKeyChecking=accept-new `
        -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 `
        -o ServerAliveCountMax=3 -o BatchMode=yes `
        seoptunel@46.101.176.117 2>> $log
    "$(Get-Date -Format s)  veza pala, ponovni pokusaj za 10 s" | Add-Content $log
    Start-Sleep 10
}
