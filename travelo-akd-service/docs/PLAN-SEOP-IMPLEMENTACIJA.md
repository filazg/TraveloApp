# SEOP — plan implementacije po metodama

Izvor: *Specifikacija web servisa za Brodare u SEOP sustavu v3.0* (AKD, 07.11.2022.),
`vanjska dokumentacija/`. Stanje koda: 11.09.2026.

Servis se zove **PlovKarte**. Ima jedanaest metoda; nama trebaju sedam. Kod danas
ima `ProvjeriPPP` i sve graditelje stringova za potpis — ni jedna dojava se ne
šalje.

---

## 0. Preduvjeti (bez ovoga se ne može ni testirati)

| Što | Od koga | Gdje ide |
| --- | --- | --- |
| Klijentski certifikat `.p12` + lozinka | AKD, po zahtjevu preko AZOLPP-a | `travelo-akd-service/cert/`, putanja u `integrations_configs.json` |
| Testno korisničko ime (= OIB brodara) i lozinka | AKD, uz certifikat | `akd.seop.brodarev_oib`, `akd.seop.lozinka` |
| `AKDCA-DEMO.crt` (CA lanac SEOP-a) | AKD | `akd.seop.akd_ca_cert_path`; tek tada se miče `rejectUnauthorized: false` iz `soapClient.js` |
| `tstseopsign.cert` (javni ključ SEOP-a) | AKD | `akd.seop.seop_sign_cert_path`, za provjeru potpisa odgovora |
| API i ključevi za čitanje čipa iskaznice | AKD | već imamo kroz TapLinx na mobilnom |

`akd.seop.environment` je sada `"mock"`. Redoslijed: `mock` → `test` → `prod`.

**Napomena (Task #417):** postavke se više ne uređuju u datoteci nego u portalu,
**Brod → SEOP**. Tablica `seop_settings` u boat servisu drži okolinu, OIB i
lozinku, prekidače po dojavama i mapiranja; certifikati se učitavaju kroz isti
ekran i ostaju kao datoteke u `travelo-akd-service/cert/`. U
`integrations_configs.json` ostaju samo URL-ovi AKD-a i zatečene vrijednosti za
instalacije bez tablice.

**Podaci koje moramo imati u matičnim podacima prije prve dojave:**

- `harbors.code` — mora biti službena oznaka luke (`HR479` i sl.). Provjeriti da
  se poklapa s AZOLPP-ovim šifrarnikom; SEOP u primjerima koristi isti oblik.
- `lines.code` — kod nas `645`, `647`. SEOP `brLinije` u primjeru je `431`.
  **Otvoreno pitanje:** je li naš `code` ujedno i službeni broj linije. Ako nije,
  treba stupac `lines.seop_line_no` i polje u portalu.
- `ticketsTypes.seop_type` i `timetablesPrices.seop_type` — postoje, popunjeni
  su šifrarnikom iz `travelo-portal/.../seopTypes.js`. Prije puštanja provjeriti
  da nijedan aktivan tip karte nije bez oznake.
- `oznPristupTocke` — oznaka računala s kojeg se dojavljuje. Prijedlog:
  `billing_devices.mark` (TID), jer ga svaka prodaja ionako nosi.
- `boats.imo` i `boats.nib` — postoje, trebaju za `DojaviIsplovljenje`.

---

## 1. Zajednička podloga — prvo ovo, prije bilo koje metode

### 1.1 Outbox umjesto izravnih poziva

Karte nastaju na **pet mjesta** u `travelo-transactions-service`:

```
finalizeTerminalSaleController.js:479   blagajna, mobilni, portal POS
finalizeWebSaleController.js:329        web prodaja
apiOrderControllers.js:201              partnerski API
partnerSaleControllers.js:101           partnerska prodaja
terminalSaleControllers.js:147          stariji terminalski put
```

Ako se SEOP zove izravno iz svakog od njih, dobivamo pet mjesta za održavanje i
prodaju koja pada kad SEOP ne odgovara. Mobilna uz to prodaje **offline** —
dojava tada nastaje satima kasnije.

Zato: tablica **`seop_outbox`** u `travelo-transactions-db` i jedan radnik.

```sql
CREATE TABLE seop_outbox (
  id            BIGSERIAL PRIMARY KEY,
  metoda        VARCHAR(40)  NOT NULL,   -- DojaviProdajuOPKEur, DojaviCvikanje…
  ticket_uuid   VARCHAR(64),             -- veza na kartu, za dijagnostiku
  payload       JSONB        NOT NULL,   -- parametri metode, već mapirani
  status        VARCHAR(16)  NOT NULL DEFAULT 'pending', -- pending|sent|failed|skipped
  pokusaja      INT          NOT NULL DEFAULT 0,
  zadnja_greska TEXT,
  ipk           VARCHAR(64),             -- ono što SEOP vrati
  transakcija   VARCHAR(64),
  potpis_ok     BOOLEAN,                 -- provjera SEOP-ovog potpisa odgovora
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "sentAt"      TIMESTAMPTZ
);
CREATE INDEX seop_outbox_status ON seop_outbox (status, id);
```

Pravila:

- Prodaja **nikad ne pada** zbog SEOP-a. Upis u outbox je u istoj transakciji kao
  i karte; slanje je zaseban posao.
- Radnik (interval ~30 s, kao `syncPendingSales` na mobilnoj) uzima `pending`
  redom po `id`, jer **redoslijed je bitan**: cvikanje ne smije otići prije
  prodaje iste karte.
- Ponovni pokušaji s odmakom; nakon N neuspjeha `failed` i vidljivo u portalu.
- `DojaviCvikanje` za kartu kojoj `seop_ipk` još nije poznat ostaje `pending` dok
  prodaja ne dobije IPK — ne šalje se i ne pada.

### 1.2 Klijent u transactions servisu

`travelo-transactions-service/helpers/seopClient.js` — isti obrazac kao postojeći
`bookingClient.js`: uzme URL akd servisa iz core configa i pozove ga HTTP-om.
Sav SOAP, certifikat i potpis ostaju u `travelo-akd-service`; transactions zna
samo za naše parametre.

### 1.3 Rute u akd servisu

Danas postoje `/seop/provjeri-ppp` i `/seop/sign-test`. Dodati, jednu po metodi:

```
POST /seop/dojavi-prodaju-opk
POST /seop/dojavi-prodaju-ppk
POST /seop/dojavi-cvikanje
POST /seop/ponisti-cvikanje
POST /seop/dojavi-isplovljenje
GET  /seop/lista-iskaznica
GET  /seop/ponistene-iskaznice
```

Svaka: mapiraj → složi string za potpis (graditelji već postoje u
`seopStringBuilders.js`) → potpiši → složi SOAP → pošalji → **provjeri potpis
odgovora** → vrati `{ transakcija, ipk, potpis_ok, poruka }`.

### 1.4 Potpis i ZKB — tri zamke

1. **ZKB je MD5 nad bajtovima potpisa**, ne nad tekstom:
   `MD5( RSA-SHA256( oznPlovKarte + oznLuke1 + … + brodarevOIB ) )`, ispis 32
   hex znaka malim slovima. U ulaz za ZKB **ne ulazi sam ZKB**.
2. **Potpis poruke uključuje ZKB.** U primjeru iz specifikacije ZKB se vraća
   malim slovima, a u string za potpis ulazi **velikim**
   (`509b406c…` → `509B406C…`). To je nedosljednost u dokumentu — provjeriti na
   AKD-ovom testu prije nego se zaključa; ovisno o ishodu, jedna linija u
   graditelju stringa.
3. Potpisuju se **svi ulazni parametri osim lozinke**, redom iz specifikacije,
   a prazni i `null` se preskaču. `asStr`/`asNum`/`asBool` u
   `seopStringBuilders.js` to već rade.

---

## 2. `DojaviProdajuOPKEur` — obična karta

**Najveći opseg i najveći rizik: svaka prodana karta, sa svih kanala.**

| SEOP parametar | Naš izvor |
| --- | --- |
| `oznPlovKarte` | `tickets.ticket_code` |
| `oznLuke1` / `oznLuke2` | `harbors.code` za `departure_harbor_id` / `arrival_harbor_id` |
| `brLinije` | `lines.code` (vidi otvoreno pitanje u t. 0) |
| `datIzd` | `invoices.issued_at`, oblik `YYYY-MM-DDTHH:mm:ss` |
| `datPut` | `tickets.departure_planed`, isti oblik |
| `redovCijenaEur` | `tickets.single_price` |
| `namjena` | `ticketsTypes.seop_type` |
| `zkb` | izračun iz t. 1.4 |
| `oznPristupTocke` | `billing_devices.mark` |
| `visestruka` | `0` (povratna karta je kod nas zasebna karta, ne višestruka) |
| `masa` | `null` za putnike; za teret iz tipa karte kad uvedemo teret |
| `brodarevOIB`, `lozinka` | config |

Hook: u istoj transakciji u kojoj se karte upisuju, jedan redak outboxa po karti.

Odgovor: `{ transakcijski_id, ipk, potpis }` → **`tickets.seop_ipk`** (stupac već
postoji). Bez IPK-a poslije nema ni cvikanja ni storna.

Rubni slučajevi:
- Storno prije nego dojava prodaje ode: red se označi `skipped`, storno se ne
  šalje.
- Ponovni ispis kopije **nije** nova prodaja — ne dojavljuje se.

---

## 3. `DojaviProdajuPPK_3Eur` — povlaštena karta

Ide kroz postojeći tok *POVLAŠTENE KARTICE*: očita se iskaznica, pozove se
`ProvjeriPPP` (radi), karta se izda po povlaštenoj cijeni.

Dodatno na OPK mapiranje:

| SEOP parametar | Naš izvor |
| --- | --- |
| `oznOtIs` / `sBrOtIs` | `tickets.seop_card_no` (UID čipa / serijski broj) |
| `povlaCijenaEur` | `tickets.single_price` (povlaštena) |
| `redovCijenaEur` | puna cijena iz cjenika za tu relaciju |
| `oznOdobrenja` | samo za virtualne iskaznice javnih službi; inače `null` |
| `uvijekProdaj` | `0` uz provjeru, **`1` kad je prodano offline ili je provjera bila negativna** |

`uvijekProdaj = 1` je put za mobilnu bez mreže i za slučaj „iskaznica poništena,
karta prodana po punoj cijeni". SEOP tada internom metodom kartu evidentira kao
običnu i vraća `Item3 = true` — to treba zapisati uz kartu.

---

## 4. `DojaviCvikanje` — ukrcaj i storno

Jedna metoda, dvije namjene:

- **Ukrcaj**: `vremTros` = vrijeme validacije, `voyageID` = naša oznaka plovidbe.
- **Storno**: `vremTros = null`.

Hook za ukrcaj: `validateTicketController.js` — ondje gdje se karta označava
`validated` i gdje se već javlja booking servisu (`reportValidation`). Isti
obrazac, samo red u outboxu.

Hook za storno: `cancelTicketsController.js`.

Ograničenja iz specifikacije koja moramo poštovati:
- Cvikanje se smije dojaviti za **tekući mjesec i za prethodni do 5. u mjesecu**.
  Zaostali red stariji od toga ide u `skipped` uz zapis razloga — inače radnik
  vrti poziv koji SEOP trajno odbija.
- Storno neiskorištene povlaštene karte **vraća pravo** korisniku, pa se ne smije
  poslati dvaput. Idempotentnost čuva `seop_outbox` (jedan red po kombinaciji
  karta + metoda).

---

## 5. `PonistiCvikanjePojedinacna` — storno ukrcaja

Trigger kod nas još ne postoji: potreban je postupak „poništi validaciju"
(pogrešno očitana karta). Prijedlog: u modulu KONTROLA, uz pojedinu validaciju,
radnja koja zapisuje poništenje i stvara red u outboxu. Potpisuje se
`{ipk, brodarevOIB}`.

Prije implementacije dogovoriti tko to smije — nije radnja za djelatnika na
vratima.

---

## 6. `DojaviIsplovljenje` — isplovljenje broda

| SEOP parametar | Naš izvor |
| --- | --- |
| `jop` | naša oznaka plovidbe; **isti podatak koji ide kao `voyageID` u cvikanju** |
| `oznLukeIsplov` / `oznLukeUplov` | `harbors.code` prve i zadnje luke noge |
| `brLinije` | kao gore |
| `vremIsplov` | stvarno vrijeme isplovljenja |
| `vremUplov` | planirano vrijeme uplovljenja |
| `imo`, `nib` | `boats.imo`, `boats.nib` |

Hook: kapetanski modul (`SailingPage`) već ima radnju nad polaskom; treba točka
„isplovio" koja upisuje stvarno vrijeme. Ako je nemamo, najbliže je
`departures.actual_departure`.

**Odluka koju treba donijeti:** što je `jop`. Mora biti stabilan i isti u cvikanju
i u isplovljenju. Prijedlog: `departure_uuid` kanonske noge (isti onaj pod kojim
booking vodi cijelu vožnju).

---

## 7. `DohvatiListuIskaznica` i `PonisteneIskaznice` — lokalni preslik

Ne trebaju za prodaju, ali rješavaju **offline**: mobilna na vratima nema mrežu,
a mora znati vrijedi li iskaznica.

- `DohvatiListuIskaznica` s `sve=1` puni lokalnu tablicu iskaznica; poslije
  dnevno s `sve=0` i `datOd` = zadnje povlačenje.
- `PonisteneIskaznice` dnevno, za brzo obaranje prava.

Ide u noćni posao u `travelo-akd-service`, a preslik se sinkronizira na mobilnu
kao i ostali matični podaci.

---

## 8. Testni protokol (AKD, poglavlje 6.3)

AKD traži da se prije produkcije dokaže, redom:

1. čitanje čipa iskaznice,
2. `ProvjeriPPP` i ispravna interpretacija odgovora,
3. `DojaviProdajuPPK_3Eur`,
4. `DojaviCvikanje` za povlaštenu,
5. `DojaviProdajuOPKEur`,
6. `DojaviCvikanje` za običnu,
7. storno neiskorištene karte i povrat prava,
8. dojava karte izdane dok je sustav bio nedostupan (**offline**, `uvijekProdaj=1`),
9. `PonistiCvikanjePojedinacna` za povlaštenu,
10. `PonistiCvikanjePojedinacna` za običnu.

Nakon toga zapisnik o testiranju → Sporazum o korištenju podataka → produkcijski
ključevi. To je administrativni put preko AZOLPP-a i traje, pa ga treba pokrenuti
paralelno s t. 1–3, ne na kraju.

---

## 9. Redoslijed rada

| Korak | Sadržaj | Ovisi o |
| --- | --- | --- |
| 1 | outbox + radnik + `seopClient` + rute u akd servisu | — |
| 2 | `DojaviProdajuOPKEur` + upis IPK-a | 1 |
| 3 | `DojaviProdajuPPK_3Eur` | 2 |
| 4 | `DojaviCvikanje` (ukrcaj + storno) | 2, 3 |
| 5 | `DojaviIsplovljenje` | odluka o `jop` |
| 6 | `PonistiCvikanjePojedinacna` | postupak u KONTROLI |
| 7 | preslik iskaznica (offline) | 1 |
| 8 | testni protokol s AKD-om | 2–7 |

Koraci 1–4 su ono što zakon traži (evidencija izdanih i iskorištenih karata);
5–7 dolaze odmah iza.

---

## 10. Otvorena pitanja

1. **Broj linije** — je li `lines.code` službeni `brLinije`? Ako nije, novi
   stupac i unos u portalu.
2. **Velika/mala slova ZKB-a u stringu za potpis** — potvrditi na AKD-ovom testu.
3. **`jop`** — koja je naša oznaka plovidbe prema SEOP-u.
4. **`masa`** — obavezna za teret; danas teret ne prodajemo kroz tipove karata.
5. **Tko smije poništiti cvikanje** i kroz koji ekran.
6. **Što s kartama prodanima prije uključenja SEOP-a** — dojavljuju se
   retroaktivno ili se kreće od datuma uključenja (vjerojatno ovo drugo, ali
   traži potvrdu AZOLPP-a).
