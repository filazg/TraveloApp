# dist-cert

Ovdje ide **javni** dio code-signing certifikata koji installer pakira u sebe i
pri prvoj instalaciji sam ubaci u Trusted Root na blagajni.

Prije **release** builda kopiraj generirani cert ovamo pod točnim imenom:

```
copy installer\signing\_out\travelo-desk-signing.cer installer\signing\dist-cert\travelo-desk-signing.cer
```

- Datoteka se MORA zvati `travelo-desk-signing.cer` (installer.nsh je traži pod
  tim imenom).
- `*.cer` je u `.gitignore` — ne commita se; ova mapa (s ovim README-om) postoji
  samo da build ima kamo pakirati.
- Ako certa ovdje nema (npr. dev build), installer preskoči korak s certom.
