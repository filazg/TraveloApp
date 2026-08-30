# TraveloAPP Partner API

## Upute za partnere

Sučelje kojim partner pretražuje polaske, rezervira i potvrđuje karte u svoje
ime, te ih po potrebi stornira.

**VERZIJA 1.05 · IZDANJE 30.08.2026.**

---

## Prije početka

**Osnovnu adresu** — zasebnu za test i za produkciju — dobivaš uz pristupne
podatke. Sve putanje u ovim uputama nadovezuju se na nju:

```
<osnovna-adresa>/auth/api_sales_login
<osnovna-adresa>/search_trip
...
```

Između testa i produkcije mijenja se samo adresa; tijela zahtjeva i izračun
kontrolnog koda ostaju isti.

**Što dobivaš od nas:**

| Podatak | Čemu služi |
| --- | --- |
| `TID` | oznaka tvog terminala |
| `OTP` | lozinka za prijavu |
| `k` | tajni ključ za kontrolni kod — ne šalje se ni u jednom zahtjevu |

Ključ `k` nikad ne putuje mrežom. Njime se **potpisuju** zahtjevi, pa ga drži
na svom poslužitelju; tko ga ima, može naručivati u tvoje ime.

**Ograničenja:** prijava 10 zahtjeva u minuti, ostali pozivi 120 u minuti po IP
adresi.

**Format:** `Content-Type: application/json`. Datum je `YYYY-MM-DD`.

---

## Prijava

```
POST /auth/api_sales_login
Content-Type: application/json

{ "tid": "SABOOK001", "otp": "<tvoj-otp>" }
```

```json
{ "msg": "token created", "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6..." }
```

Token vrijedi **24 sata** i ide u zaglavlju svakog daljnjeg zahtjeva:

```
Authorization: Bearer <token>
```

Istekao ili neispravan token vraća `401`. Prijavi se ponovno; nemoj se
prijavljivati pri svakom pozivu.

---

## Kontrolni kod

Zahtjevi koji nose novac ili stvaraju obvezu potpisuju se poljem
`control_code`. Kod je **SHA512 heksadecimalno**, računat nad ključem `k` i
vrijednostima polja **točno ovim redoslijedom**:

| Endpoint | Što se spaja |
| --- | --- |
| `/search_trip` | `k` + `travel_from` + `travel_date` + `travel_to` |
| `/order` | `k` + `order_number` + broj stavaka + zbroj `total_item_price` |
| `/confirm_order` | `k` + `order_uuid` + `order_number` + `total_amount` |
| `/cancel_order` | `k` + `order_uuid` + `order_number` + `total_amount` |

Brojevi se spajaju kako se ispisuju (`2`, `50`), bez razmaka i razdjelnika.

Kod potvrde i storna `order_number` i `total_amount` **ne šalješ** — uzimamo ih
s narudžbe kod nas, a ti ih u kod uvrštavaš iz odgovora koji si dobio pri
kreiranju narudžbe. Tako se kod ne može složiti nad iznosom koji nije naš.

Primjer (Node.js):

```js
const crypto = require("crypto");

const control_code = crypto
    .createHash("sha512")
    .update(k + "HR479" + "2026-09-05" + "HR364")
    .digest("hex");
```

Ne slaže li se kod, odgovor je `400 Invalid control_code`.

---

## Tijek prodaje

Narudžba prolazi tri stanja:

```
/order            ->  DRAFT       rezervirana mjesta, karte još ne postoje
/confirm_order    ->  CONFIRMED   karte izdane, mjesta potrošena
/cancel_order     ->  CANCELED    karte stornirane, mjesta vraćena
```

Nepotvrđena narudžba ne obvezuje ni tebe ni nas, ali **drži mjesta** — ne
ostavljaj je otvorenom dulje nego što traje plaćanje kod tebe.

---

### 1. Luke

```
GET /harbors
Authorization: Bearer <token>
```

```json
{
  "harbors": [
    {
      "harbor_name": "Split",
      "harbor_code": "HR479",
      "harbor_longitude": null,
      "harbor_latitude": null,
      "harbor_region": "LUČKA UPRAVA SPLIT",
      "harbor_country": null
    }
  ]
}
```

U svim daljnjim pozivima luku identificira **`harbor_code`**.

---

### 2. Pretraga polazaka

```
POST /search_trip
Authorization: Bearer <token>

{
  "travel_from": "HR479",
  "travel_to": "HR364",
  "travel_date": "2026-09-05",
  "control_code": "<sha512>"
}
```

```json
{
  "trips": [
    {
      "trip_uuid": "9d01110a-2c95-44d4-b301-784708d9ff94",
      "departure": "05.09.2026. 08:00",
      "arrival": "05.09.2026. 09:00",
      "departure_harbor_id": "HR479",
      "departure_harbor_name": "Split",
      "arrival_harbor_id": "HR364",
      "arrival_harbor_name": "Hvar",
      "line_code": "647",
      "line_name": "Split – Milna – Hvar – Korčula – Pomena – Dubrovnik",
      "prices": [
        {
          "ticket_type_uuid": "f6a99f5f-174d-4f00-a38b-f3e79dfc91a0",
          "ticket_type_name": "Redovna",
          "price": 25,
          "capacity": 100,
          "description": null
        }
      ]
    }
  ]
}
```

- `trip_uuid` je ono što se šalje u narudžbu.
- **Cijena je tvoja nabavna cijena**, ona po kojoj ti fakturiramo — ne cijena
  koju naplaćuješ putniku. Ovisno o dogovoru šalje se s PDV-om ili bez njega;
  lučka pristojba je uvijek uključena.
- **Polasci kojima je vrijeme prošlo se ne vraćaju.** Prazan `trips` znači da
  na toj relaciji tog dana nema polaska — nije greška.

---

### 3. Narudžba

```
POST /order
Authorization: Bearer <token>

{
  "order_number": "BW-2026-000123",
  "order_items": [
    {
      "trip_uuid": "9d01110a-2c95-44d4-b301-784708d9ff94",
      "ticket_type_uuid": "f6a99f5f-174d-4f00-a38b-f3e79dfc91a0",
      "ticket_type_name": "Redovna",
      "quantity": 2,
      "single_item_price": 25,
      "total_item_price": 50
    }
  ],
  "control_code": "<sha512>"
}
```

```json
{
  "msg": "order created",
  "order_uuid": "f0a1…",
  "order_number": "BW-2026-000123",
  "order_items": [ … ]
}
```

`order_number` je **tvoj** broj narudžbe; po njemu se poslije prepoznaje na
obračunu. `order_uuid` je naš — čuvaj ga, treba za potvrdu i storno.

Nema li dovoljno slobodnih mjesta, odgovor je `409` i narudžba se ne stvara.

---

### 4. Potvrda narudžbe

```
POST /confirm_order
Authorization: Bearer <token>

{ "order_uuid": "f0a1…", "control_code": "<sha512>" }
```

```json
{
  "tickets": [
    {
      "ticket_uuid": "…",
      "ticket_code": "HEXNYZ7DHA",
      "order_uuid": "f0a1…",
      "order_number": "BW-2026-000123",
      "ticket_type_name": "Redovna",
      "ticket_single_price": 25,
      "ticket_is_active": true,
      "ticket_is_canceled": false,
      "ticket_departure": "05.09.2026. 08:00",
      "line_code": "647",
      "ticket_departure_harbor_name": "Split",
      "ticket_arrival_harbor_name": "Hvar"
    }
  ]
}
```

Tek je ovime karta izdana. **`ticket_code` je ono što putnik pokazuje pri
ukrcaju** — ispiši ga na kartu i kao crtični ili QR kod.

Potvrdu radi tek kad je plaćanje kod tebe prošlo: nakon nje karte postoje i
naplaćuju se, a poništavaju se samo stornom.

---

### 5. Storno

```
POST /cancel_order
Authorization: Bearer <token>

{ "order_uuid": "f0a1…", "control_code": "<sha512>" }
```

```json
{
  "msg": "tickets canceled",
  "return_amount": 50,
  "canceled_tickets": [ … ]
}
```

Bez dodatnih polja stornira se cijela narudžba. Za dio karata pošalji
`tickets` s njihovim `ticket_uuid`; `return_amount` je iznos koji ti se
odobrava.

Već stornirana karta ne stornira se drugi put.

---

### 6. Detalji putovanja

```
POST /trip_details
Authorization: Bearer <token>

{ "trip_uuid": "9d01110a-2c95-44d4-b301-784708d9ff94" }
```

```json
{
  "trip_details": [
    {
      "departure_harbor_id": "HR479",
      "departure_harbor_name": "Split",
      "departure_planed": "05.09.2026. 08:00",
      "departure": "05.09.2026. 08:00",
      "arrival_harbor_id": "HR364",
      "arrival_harbor_name": "Hvar",
      "arrival_planed": "05.09.2026. 09:00",
      "arrival": "05.09.2026. 09:00",
      "harbor_order": 10
    }
  ]
}
```

Vraća sve luke tog polaska po redu plovidbe — za prikaz međuluka i vremena.
Ne traži kontrolni kod.

---

## Greške

| Status | Kada | Tijelo |
| --- | --- | --- |
| 400 | nedostaje polje ili kontrolni kod ne odgovara | `{"msg": "Invalid control_code"}` |
| 401 | nema tokena, token istekao ili krivi TID/OTP | `{"msg": "Unauthorized"}` |
| 404 | narudžba ili polazak ne postoji, ili nije tvoj | `{"msg": "Order not found"}` |
| 409 | nema dovoljno slobodnih mjesta | `{"msg": "…"}` |
| 429 | previše zahtjeva u minuti | — |

Tuđa narudžba vraća `404`, ne `403` — po odgovoru se ne može doznati postoji
li uopće.

---

## Naplata

Karte prodane preko API-ja ne plaćaju se pojedinačno. Prodaja se skuplja i
fakturira **zbirno, po dogovorenoj dinamici**, po cijenama koje dobivaš u
`search_trip`. Na obračunu se vidi tvoj `order_number` i TID terminala s kojeg
je karta izdana.

---

## Provjera prije puštanja u rad

- [ ] ključ `k` stoji na poslužitelju i ne šalje se ni u jednom zahtjevu
- [ ] token se pamti 24 sata, ne dohvaća se pri svakom pozivu
- [ ] polja u kontrolnom kodu idu točno propisanim redoslijedom
- [ ] `order_uuid` iz odgovora se čuva uz narudžbu
- [ ] potvrda ide tek nakon uspješne naplate kod tebe
- [ ] nepotvrđene narudžbe se ne ostavljaju otvorene — drže mjesta
- [ ] `ticket_code` je na karti i strojno čitljiv
- [ ] prazan `trips` prikazuje se kao „nema polaska", ne kao greška

---

Za pristupne podatke, promjenu cjenika ili prelazak na produkcijsku adresu
javi se podršci.
