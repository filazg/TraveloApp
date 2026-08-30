# TraveloAPP Web Page API

## Upute za izrađivača web stranice

Sučelje kojim web stranica dohvaća luke, polaske s cijenama i obavijesti, te
posjetitelja šalje u prodaju karata.

**VERZIJA 1.1 · IZDANJE 30.08.2026.**

---

## Prije početka

**Osnovna adresa** (test):

```
https://bookingtest.krilo.hr/web_sale
```

Za produkciju se mijenja samo domena; putanje i tijela zahtjeva ostaju isti.

**Ključ.** Svaki zahtjev nosi zaglavlje `x-api-key` s ključem koji dobiješ od
nas. Ključ je vezan uz jednog korisnika i može se povući bez dodirivanja
ostalih, pa ga nemoj dijeliti dalje.

```
x-api-key: <tvoj-kljuc>
```

**Odakle zvati.** Ključ ne smije završiti u pregledniku — svatko tko otvori
stranicu vidio bi ga u mrežnom prometu. Zovi sa svog poslužitelja i podatke
proslijedi stranici. Ako baš treba zvati iz preglednika, javi nam domenu pa je
upišemo u popis dopuštenih (CORS); bez toga preglednik odbija odgovor.

**Ograničenje.** 30 zahtjeva u minuti po IP adresi. Popis luka i obavijesti se
mijenjaju rijetko — zapamti odgovor na nekoliko minuta umjesto da ih dohvaćaš
pri svakom otvaranju stranice.

**Format.** `Content-Type: application/json` za POST. Datum je uvijek
`YYYY-MM-DD`.

---

## Endpointi

| Metoda | Putanja | Čemu služi |
| --- | --- | --- |
| GET | `/web_page_harbors` | popis luka |
| POST | `/web_page_search_trips` | polasci i cijene za relaciju i datum |
| GET | `/web_page_info` | obavijesti za prikaz na stranici |
| POST | `/web_page_redirect` | adresa za slanje posjetitelja u prodaju |
| GET | `/web_page_business_premises` | prodajna mjesta |
| GET | `/web_page_documentations` | ove upute u PDF-u |

---

### 1. Luke

```
GET /web_sale/web_page_harbors
x-api-key: <tvoj-kljuc>
```

```json
{
  "status": 200,
  "harbors": [
    {
      "uuid": "843436c0-8d15-4060-8c1f-c04a7956f99b",
      "name": "Split",
      "code": "HR479",
      "longitude": null,
      "latitude": null,
      "city": null,
      "region_uuid": "0eb249b6-e564-4a68-a231-bef9654c96f8",
      "country": null
    }
  ]
}
```

Za sve daljnje pozive luku identificira **`code`** (`HR479`), ne `uuid` i ne
naziv. Naziv se mijenja, šifra ne.

---

### 2. Polasci i cijene

```
POST /web_sale/web_page_search_trips
Content-Type: application/json
x-api-key: <tvoj-kljuc>

{
  "travel_from_code": "HR479",
  "travel_to_code": "HR364",
  "travel_date": "2026-09-05"
}
```

```json
{
  "status": 200,
  "trips": [
    {
      "id": 1702,
      "uuid": "9d01110a-2c95-44d4-b301-784708d9ff94",
      "departure": "05.09.2026. 08:00",
      "actual_departure": "05.09.2026. 08:00",
      "arrival": "05.09.2026. 09:00",
      "actual_arrival": "05.09.2026. 09:00",
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
          "price": "25",
          "is_island": false,
          "vat_base": "18.8",
          "vat": "4.7",
          "harbor_tax": "1.5",
          "description": null
        }
      ]
    }
  ]
}
```

Što treba znati o odgovoru:

- **`departure` je planirano vrijeme, `actual_departure` stvarno.** Kad se
  polazak pomakne, razlikuju se — prikaži `actual_departure`.
- **Cijena je konačna, s PDV-om i lučkom pristojbom.** `vat_base`, `vat` i
  `harbor_tax` su razrada istog iznosa, ne dodaci na njega.
- **Vrsta karte `is_island: true`** je povlaštena otočna karta; nju se ne nudi
  javno jer traži provjeru otočne iskaznice.
- **Prazan `trips`** znači da tog dana na toj relaciji nema polaska — nije
  greška.
- **Otkazani polasci se ne vraćaju**, kao ni oni kojima je prošlo vrijeme
  zatvaranja prodaje. Popis je uvijek ono što se u tom trenutku može kupiti.
- **Broj slobodnih mjesta se ne vraća.** Raspoloživost se provjerava u samoj
  prodaji, pri kupnji.

---

### 3. Obavijesti

```
GET /web_sale/web_page_info
x-api-key: <tvoj-kljuc>
```

```json
{
  "status": 200,
  "informations": [
    {
      "uuid": "125046da-8662-41c0-a3ec-9d9280c9e5a9",
      "title": "Prekid plovidbe",
      "text": "Zbog nevremena polazak u 17:00 ne plovi.",
      "severity": "urgent",
      "valid_from": "2026-08-30T14:10:59.172Z",
      "valid_to": "2026-08-30T16:10:59.172Z"
    }
  ]
}
```

Obavijesti piše naša služba, a stranica ih samo prikazuje. **Vraćaju se samo
one koje trenutno vrijede** — razdoblje prikaza računamo mi, pa ga ne treba
ponovno provjeravati. Prazan popis znači da nema ničega za prikazati; tada
blok obavijesti ne prikazuj.

`severity` govori koliko je obavijest ozbiljna i po njemu biraj prikaz:

| Vrijednost | Značenje | Prijedlog prikaza |
| --- | --- | --- |
| `info` | obavijest | neutralna traka |
| `warning` | upozorenje | žuta traka |
| `urgent` | hitno | crvena traka, na vrhu stranice |

`valid_from` i `valid_to` su informativni (mogu biti `null` = bez granice);
služe ako uz obavijest želiš ispisati do kada vrijedi.

---

### 4. Slanje posjetitelja u prodaju

```
POST /web_sale/web_page_redirect
Content-Type: application/json
x-api-key: <tvoj-kljuc>

{
  "travel_from_code": "HR479",
  "travel_to_code": "HR364",
  "travel_date": "2026-09-05"
}
```

```json
{
  "redirectUrl": "https://bookingtest.krilo.hr/?from=HR479&to=HR364&date=2026-09-05&partner=web"
}
```

Posjetitelja preusmjeri na dobivenu adresu. Prodaja se otvara s **već
popunjenom pretragom** i dohvaćenim polascima za taj dan — putnik samo bira
polazak.

Adresu nemoj sastavljati sam: u njoj je i oznaka po kojoj u prodaji vidimo
odakle je posjetitelj došao, a domena se razlikuje na testu i u produkciji.

---

### 5. Prodajna mjesta

```
GET /web_sale/web_page_business_premises
x-api-key: <tvoj-kljuc>
```

```json
{
  "business_premises": [
    {
      "name": "Split 1",
      "type": "POSL",
      "address": null,
      "postal_code": null,
      "town": null,
      "country": null,
      "working_time": null
    }
  ]
}
```

Koristi se za stranicu s prodajnim mjestima. Polja koja nisu popunjena dolaze
kao `null` — ispisuj samo ona koja imaju vrijednost.

---

## Greške

| Status | Kada | Tijelo |
| --- | --- | --- |
| 400 | neispravno tijelo ili format datuma | `{"error": "travel_date must be in YYYY-MM-DD format"}` |
| 401 | nema zaglavlja `x-api-key` | `{"error": "Missing x-api-key header"}` |
| 403 | ključ nije prepoznat | `{"error": "Unauthorized partner"}` |
| 429 | previše zahtjeva u minuti | `{"error": "Too many requests. Try again in a minute."}` |

Na 429 pričekaj i ponovi; ne vrti pokušaje u petlji. Ako poslužitelj ne
odgovori, prikaži stranicu bez tog dijela — obavijesti i popis polazaka nisu
razlog da stranica ne radi.

---

## Provjera prije objave

- [ ] ključ stoji na poslužitelju, ne u kodu stranice
- [ ] luke se traže po `code`
- [ ] prikazuje se `actual_departure`, ne `departure`
- [ ] prazan `trips` daje poruku „nema polaska", ne grešku
- [ ] obavijesti se prikazuju po `severity`, a prazan popis skriva blok
- [ ] posjetitelj se šalje na `redirectUrl` iz odgovora, ne na ručno složenu adresu
- [ ] odgovori se pamte nekoliko minuta, zbog ograničenja od 30 zahtjeva u minuti

---

Za ključ, dopuštenu domenu ili prelazak na produkcijsku adresu javi se
podršci.
