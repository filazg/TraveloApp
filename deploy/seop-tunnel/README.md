# SEOP tunel (uredsko racunalo -> VM)

AKD (`seop.akd.hr:9444`) pusta samo hrvatske mreze. Test VM je u inozemstvu, pa
SEOP promet ide kroz obrnuti SSH tunel koji otvara uredsko racunalo.

## Uredsko racunalo (Windows)

Sve je u `C:\ProgramData\Travelo\seop-tunnel\` - prava samo SYSTEM i
Administrators, pa se mapa vidi **samo iz PowerShella pokrenutog kao administrator**.

| datoteka | sto je |
|---|---|
| `id_ed25519`, `id_ed25519.pub` | kljuc; javni je upisan na VM-u kod `seoptunel` |
| `tunel.ps1` | petlja oko `ssh -N -R` (kopija iz ovog direktorija) |
| `known_hosts` | nastaje sam pri prvom spajanju |
| `tunel.log` | dnevnik spajanja |

Prava na kljuc - ssh pod SYSTEM-om odbija kljuc koji smije citati jos netko
(`UNPROTECTED PRIVATE KEY FILE` / `bad permissions`). Na kljucu smiju ostati
**samo** SYSTEM i Administrators (SID-ovi jer su imena grupa lokalizirana):

```powershell
$k = 'C:\ProgramData\Travelo\seop-tunnel\id_ed25519'
icacls $k /setowner "*S-1-5-18"
icacls $k /inheritance:r /grant:r "*S-1-5-18:F" "*S-1-5-32-544:F"
icacls $k /remove "RACUNALO\korisnik"   # svaki drugi redak koji icacls $k pokaze
```

Registracija zadatka (admin PowerShell; rucni tunel prije toga zatvoriti):

```powershell
schtasks /Create /TN "Travelo SEOP tunel" /RU SYSTEM /SC ONSTART /RL HIGHEST /F /TR "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\ProgramData\Travelo\seop-tunnel\tunel.ps1"
schtasks /Run /TN "Travelo SEOP tunel"
schtasks /Query /TN "Travelo SEOP tunel"
Get-Content C:\ProgramData\Travelo\seop-tunnel\tunel.log -Tail 20
```

Rucna proba (admin PowerShell, radi dok je prozor otvoren):

```powershell
ssh -N -R 127.0.0.1:9444:seop.akd.hr:9444 -i C:\ProgramData\Travelo\seop-tunnel\id_ed25519 seoptunel@46.101.176.117
```

## VM

- korisnik `seoptunel` (ljuska `nologin`), `authorized_keys`:
  `restrict,port-forwarding,permitlisten="127.0.0.1:9444",permitopen="127.0.0.1:1" ssh-ed25519 ...`
- `sshd_config`: `ClientAliveInterval 30`, `ClientAliveCountMax 3` (inace port 9444
  ostane zauzet nakon pada veze)
- `/etc/hosts`: `127.0.0.1 seop.akd.hr`

Provjera:

```bash
ss -ltnp | grep 9444       # 127.0.0.1:9444
curl -s -X POST localhost:7070/seop/test-veze -d '{}' -H 'Content-Type: application/json'   # "ok":true
```

## Kvarovi

| simptom | uzrok |
|---|---|
| `ECONNREFUSED 127.0.0.1:9444` na VM-u | tunel nije gore - provjeri zadatak i `tunel.log` |
| u logu `remote port forwarding failed` | stara veza drzi port; na VM-u `pkill -u seoptunel` |
| u logu `bad permissions` pa `Permission denied` | na kljucu ima jos netko osim SYSTEM/Administrators - vidi gore |
| u logu `Permission denied (publickey)` bez `bad permissions` | na VM-u nije ovaj kljuc |
| mapa "ne postoji", zadatak se ne vidi | PowerShell nije pokrenut kao administrator |
| tunel radi, SEOP i dalje mock | okolina u `integrations_configs.test_do.json` (`akd.seop.environment`) |
