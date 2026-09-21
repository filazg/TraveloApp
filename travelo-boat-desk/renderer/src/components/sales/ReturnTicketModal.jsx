import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  MenuItem, Paper, Stack, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "dayjs/locale/hr";
import { v4 as uuid } from "uuid";

import { allAppData, setStateData } from "../../store/appSlice";
import IslandReturnScanner from "./IslandReturnScanner";

// Povratna karta za stavku iz košarice.
//
// Povratak je ista relacija u suprotnom smjeru, pa se luke uzimaju iz stavke i
// zamijene. Blagajnik bira samo dan i polazak; vrste karata i količine dolaze
// postavljene onako kako su na polaznoj stavci, jer se u pravilu vraćaju isti
// putnici — a mogu se ispraviti (dijete se vraća samo, netko ostaje dulje).
//
// Povratak se u košaricu dodaje kao zasebna stavka sa svojim polaskom. Tako ga
// booking servis rezervira na pravoj etapi, a na računu i karti stoji stvarna
// vožnja — bez toga bi povratak visio na polaznoj ruti i zauzeo krivi brod.

// Polazak se u plovidbenom redu zapisuje kao "DD.MM.YYYY. HH:mm"; za prikaz
// treba samo sat. Pomaknut polazak vrijedi po stvarnom vremenu.
const samoVrijeme = (v) => {
  const m = /(\d{1,2}):(\d{2})/.exec(String(v || ""));
  return m ? String(m[1]).padStart(2, "0") + ":" + m[2] : "";
};

const vrijemeRute = (r) => samoVrijeme(r?.actual_departure || r?.departure || r?.departure_time);

// Datum putovanja se u pretrazi drži kao "DD/MM/YYYY" (toLocaleDateString
// "en-GB"). Isti oblik nosi i `departure_date` na rutama, pa se usporeduje bez
// pretvaranja u Date — taj oblik `new Date()` ionako ne zna procitati.
const uEnGb = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "");

// Polazak i dolazak su tekst "DD.MM.YYYY. HH:mm"; `new Date()` taj oblik ne
// zna procitati pa se rastavlja rukom. Vraca null kad oblik nije prepoznat —
// tada se ne zakljucuje nista o redoslijedu.
const trenutak = (v) => {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s+(\d{1,2}):(\d{2})/.exec(String(v || "").trim());
  if (!m) return null;
  const [, d, mo, y, hh, mm] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm));
};

const sutra = (d) => {
  const n = new Date(d);
  n.setDate(n.getDate() + 1);
  return n;
};

const izEnGb = (s) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || ""));
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date();
};

export default function ReturnTicketModal({ stavka, onClose }) {
  const dispatch = useDispatch();
  const appData = useSelector(allAppData);

  const [dan, setDan] = useState(() => izEnGb(appData.searchData?.travelDate));
  const [rutaUuid, setRutaUuid] = useState("");
  const [kolicine, setKolicine] = useState({});

  // Otočne (povlaštene) karte s polazne stavke: traže iskaznicu, pa se za
  // povratak bira količina (npr. 2 od 3) i onda skenira toliko kartica.
  const otocneUlazneTotal = useMemo(
    () => (stavka?.ticketsData || []).filter((t) => t.povlastica).reduce((s, t) => s + (Number(t.quantity) || 0), 0),
    [stavka]
  );
  const [otocnaKolicina, setOtocnaKolicina] = useState(0);
  const [otocnaDirana, setOtocnaDirana] = useState(false);
  const [skenerOtvoren, setSkenerOtvoren] = useState(false);
  useEffect(() => {
    if (!otocnaDirana) setOtocnaKolicina(otocneUlazneTotal);
  }, [otocneUlazneTotal, otocnaDirana]);
  const postaviOtocnu = (v) => {
    setOtocnaDirana(true);
    setOtocnaKolicina(Math.max(0, Math.min(otocneUlazneTotal, parseInt(v, 10) || 0)));
  };

  // Polasci u suprotnom smjeru za zadani dan: iz luke dolaska polazne stavke
  // natrag u luku iz koje se krenulo. Nude se SVE linije koje voze tu relaciju,
  // ne samo polazna — povratak istom relacijom moze ici drugom linijom.
  const ruteZaDan = (datum) => {
    const sve = appData.transportData?.routes || [];
    const trazeni = uEnGb(datum);
    return sve
      .filter((r) => r.departure_date === trazeni
        && r.departure_harbor_id === stavka?.arrival_harbor_id
        && r.arrival_harbor_id === stavka?.departure_harbor_id)
      .sort((a, b) => vrijemeRute(a).localeCompare(vrijemeRute(b)));
  };

  const povratneRute = useMemo(
    () => ruteZaDan(dan),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stavka, dan, appData.transportData]
  );

  const ruta = povratneRute.find((r) => r.uuid === rutaUuid) || null;

  // Zadani povratak: prvi koji krece nakon sto polazna voznja stigne; ako ga
  // tog dana vise nema, prvi sutrasnji. Racuna se kao cista vrijednost, ne u
  // ucinku — React u razvoju ucinke pokrece dvaput, pa je prijasnja izvedba sa
  // zastavicom "vec postavljeno" u drugom prolazu padala na prvi polazak dana.
  // Tako se za voznju Split-Hvar u 11:00 nudio povratak u 10:15, prije nego
  // brod uopce stigne.
  const zadano = useMemo(() => {
    if (!stavka) return null;
    if (!(appData.transportData?.routes || []).length) return null;

    const dolazak = trenutak(stavka.arrival) || trenutak(stavka.departure);
    const danOdlaska = dolazak || izEnGb(appData.searchData?.travelDate);
    const danasnje = ruteZaDan(danOdlaska);
    const sljedeca = dolazak
      ? danasnje.find((r) => {
        const t = trenutak(r.actual_departure || r.departure);
        return t && t > dolazak;
      })
      : danasnje[0];
    if (sljedeca) return { dan: danOdlaska, uuid: sljedeca.uuid };

    const sutrasnji = sutra(danOdlaska);
    return { dan: sutrasnji, uuid: ruteZaDan(sutrasnji)[0]?.uuid || "" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stavka, appData.transportData]);

  // Cim blagajnik sam dirne dan ili polazak, zadano se vise ne namece.
  const [rucniOdabir, setRucniOdabir] = useState(false);

  useEffect(() => {
    if (rucniOdabir || !zadano) return;
    // Postavljanje je idempotentno: ponovljeni prolaz upisuje iste vrijednosti.
    setDan(zadano.dan);
    setRutaUuid(zadano.uuid);
  }, [zadano, rucniOdabir]);

  // Nakon rucne promjene dana uzima se prvi polazak tog dana; prazno polje bi
  // trazilo dodatni klik.
  useEffect(() => {
    if (!rucniOdabir) return;
    if (povratneRute.length && !povratneRute.some((r) => r.uuid === rutaUuid)) {
      setRutaUuid(povratneRute[0].uuid);
    }
    if (!povratneRute.length && rutaUuid) setRutaUuid("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [povratneRute, rucniOdabir]);

  // Cjenik povratne relacije. Cijene su unesene za jedan smjer, pa se traži i
  // obrnuti par luka — isto kao pri odabiru odredišta.
  const cjenik = useMemo(() => {
    if (!ruta) return [];
    const sve = appData.transportData?.route_prices || [];
    const odgovara = sve.filter((p) => p.timetable_uuid === ruta.timetable_uuid
      && p.is_active !== false
      && p.is_island !== true
      && ((p.harbor_from_code === ruta.departure_harbor_id && p.harbor_to_code === ruta.arrival_harbor_id)
        || (p.harbor_to_code === ruta.departure_harbor_id && p.harbor_from_code === ruta.arrival_harbor_id)));
    const vidjeni = new Map();
    for (const p of odgovara) {
      if (!vidjeni.has(p.ticket_type_uuid)) vidjeni.set(p.ticket_type_uuid, p);
    }
    return [...vidjeni.values()];
  }, [ruta, appData.transportData]);

  // Početne količine prepisuju polaznu stavku. Vrsta karte koje u povratnom
  // cjeniku nema ostaje na nuli — ne izmišlja se cijena koja nije unesena.
  // Kolicine se prepisuju s polazne stavke dok ih blagajnik ne dirne; nakon
  // toga promjena polaska ne smije pobrisati njegov ispravak.
  const [kolicineDirane, setKolicineDirane] = useState(false);
  useEffect(() => {
    if (!stavka || !cjenik.length || kolicineDirane) return;
    const poVrsti = {};
    for (const t of stavka.ticketsData || []) {
      poVrsti[t.ticket_type_uuid] = Number(t.quantity) || 0;
    }
    const pocetne = {};
    for (const p of cjenik) pocetne[p.ticket_type_uuid] = poVrsti[p.ticket_type_uuid] || 0;
    setKolicine(pocetne);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stavka, cjenik, kolicineDirane]);

  const postavi = (ttUuid, vrijednost) => {
    const broj = Math.max(0, Math.min(999, parseInt(vrijednost, 10) || 0));
    setKolicineDirane(true);
    setKolicine((p) => ({ ...p, [ttUuid]: broj }));
  };

  const ukupno = cjenik.reduce(
    (zbroj, p) => zbroj + (Number(p.price) || 0) * (kolicine[p.ticket_type_uuid] || 0),
    0
  );
  const imaKarata = cjenik.some((p) => (kolicine[p.ticket_type_uuid] || 0) > 0);
  // Potvrda je moguća kad ima običnih karata ILI odabranih otočnih za skeniranje.
  const mozePotvrditi = !!ruta && (imaKarata || otocnaKolicina > 0);

  const potvrdi = () => {
    if (!mozePotvrditi) return;
    const postojece = appData.saleData?.addedTickets || [];
    let redni = postojece.length;
    const nove = [];
    for (const cijena of cjenik) {
      const kol = kolicine[cijena.ticket_type_uuid] || 0;
      if (!kol) continue;
      const karte = [];
      for (let i = 0; i < kol; i++) karte.push({ uuid: uuid(), code: uuid() });
      redni += 1;
      nove.push({
        id: redni,
        sales_route_uuid: ruta.uuid,
        line_code: ruta.line_code,
        line_name: ruta.line_name,
        departure: ruta.departure,
        departure_harbor_id: ruta.departure_harbor_id,
        departure_harbor_name: ruta.departure_harbor_name,
        arrival: ruta.arrival,
        arrival_harbor_id: ruta.arrival_harbor_id,
        arrival_harbor_name: ruta.arrival_harbor_name,
        ticket_type_name: cijena.ticket_type_name,
        ticket_type_id: cijena.ticket_type_id,
        ticket_type_uuid: cijena.ticket_type_uuid,
        ticket_group_uuid: uuid(),
        single_price: cijena.price,
        total_price: cijena.price * kol,
        total_vat_base: cijena.vat_base * kol,
        total_vat: cijena.vat_amount * kol,
        total_harbor_tax: cijena.port_tax * kol,
        quantity: kol,
        tickets: karte,
      });
    }
    if (nove.length) {
      dispatch(setStateData({ path: "saleData/addedTickets", value: [...postojece, ...nove] }));
    }
    // Otočne se ne mogu dodati bez iskaznice — nakon običnih ide skeniranje
    // odabranog broja kartica (svaka svoja provjera prava na povratnoj ruti).
    if (otocnaKolicina > 0) {
      setSkenerOtvoren(true);
      return;
    }
    onClose();
  };

  if (!stavka) return null;

  // Skeniranje otočnih iskaznica za povratak na odabranoj ruti.
  if (skenerOtvoren && ruta) {
    return <IslandReturnScanner ruta={ruta} kolicina={otocnaKolicina} onClose={onClose} />;
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        Povratna karta
        <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {`Polazak: ${stavka.departure_harbor_name} → ${stavka.arrival_harbor_name}, ${stavka.departure || ""}`}
          {stavka.arrival ? ` · dolazak ${stavka.arrival}` : " · dolazak nepoznat"}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Typography sx={{ fontWeight: 800, textTransform: "uppercase", mb: 1.5 }}>
          {`${stavka.arrival_harbor_name} → ${stavka.departure_harbor_name}`}
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="hr">
            <DatePicker
              label="Datum povratka"
              format="DD.MM.YYYY"
              disablePast
              sx={{ flex: 1 }}
              value={dayjs(dan)}
              onChange={(v) => { if (v?.$d) { setRucniOdabir(true); setDan(v.$d); } }}
            />
          </LocalizationProvider>

          <TextField
            select
            label="Polazak"
            sx={{ flex: 1 }}
            value={rutaUuid}
            onChange={(e) => { setRucniOdabir(true); setRutaUuid(e.target.value); }}
            disabled={!povratneRute.length}
          >
            {povratneRute.map((r) => (
              <MenuItem key={r.uuid} value={r.uuid}>
                {`${vrijemeRute(r)} · linija ${r.line_code || ""}${r.direction ? ` · smjer ${r.direction}` : ""}`}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {!povratneRute.length ? (
          <Typography color="error" sx={{ fontWeight: 700 }}>
            Za taj dan nema povratka na ovoj relaciji. Odaberite drugi datum.
          </Typography>
        ) : (!cjenik.length && otocneUlazneTotal === 0) ? (
          <Typography color="error" sx={{ fontWeight: 700 }}>
            Za povratnu relaciju nije unesen cjenik. Javite podršci; karta se ne može prodati.
          </Typography>
        ) : (
          <>
            <Divider sx={{ mb: 1.5 }} />
            {cjenik.map((p) => (
              <Paper key={p.ticket_type_uuid} variant="accent" sx={{ p: 1.5, mb: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>{p.ticket_type_name}</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{Number(p.price).toFixed(2)} EUR</Typography>
                </Box>
                <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
                  <Button
                    variant="outlined"
                    color="error"
                    sx={{ minWidth: 56, height: 48 }}
                    onClick={() => postavi(p.ticket_type_uuid, (kolicine[p.ticket_type_uuid] || 0) - 1)}
                  >
                    <RemoveIcon />
                  </Button>
                  <TextField
                    value={kolicine[p.ticket_type_uuid] ?? 0}
                    onChange={(e) => postavi(p.ticket_type_uuid, e.target.value.replace(/[^0-9]/g, ""))}
                    onFocus={(e) => e.target.select()}
                    inputProps={{
                      inputMode: "numeric",
                      style: { textAlign: "center", fontSize: "1.25rem", height: 48, padding: 0 },
                    }}
                    sx={{ width: 110, "& .MuiOutlinedInput-root": { height: 48 } }}
                  />
                  <Button
                    variant="outlined"
                    color="success"
                    sx={{ minWidth: 56, height: 48 }}
                    onClick={() => postavi(p.ticket_type_uuid, (kolicine[p.ticket_type_uuid] || 0) + 1)}
                  >
                    <AddIcon />
                  </Button>
                </Stack>
              </Paper>
            ))}

            {otocneUlazneTotal > 0 && (
              <Paper variant="accent" sx={{ p: 1.5, mb: 1, mt: cjenik.length ? 1.5 : 0 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>Povlaštene (otočne) — povratak</Typography>
                  <Typography variant="body2" color="text.secondary">od {otocneUlazneTotal}</Typography>
                </Box>
                <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
                  <Button
                    variant="outlined"
                    color="error"
                    sx={{ minWidth: 56, height: 48 }}
                    onClick={() => postaviOtocnu(otocnaKolicina - 1)}
                  >
                    <RemoveIcon />
                  </Button>
                  <TextField
                    value={otocnaKolicina}
                    onChange={(e) => postaviOtocnu(e.target.value.replace(/[^0-9]/g, ""))}
                    onFocus={(e) => e.target.select()}
                    inputProps={{
                      inputMode: "numeric",
                      style: { textAlign: "center", fontSize: "1.25rem", height: 48, padding: 0 },
                    }}
                    sx={{ width: 110, "& .MuiOutlinedInput-root": { height: 48 } }}
                  />
                  <Button
                    variant="outlined"
                    color="success"
                    sx={{ minWidth: 56, height: 48 }}
                    onClick={() => postaviOtocnu(otocnaKolicina + 1)}
                  >
                    <AddIcon />
                  </Button>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Otočne traže iskaznicu — nakon potvrde skenira se {otocnaKolicina} {otocnaKolicina === 1 ? "kartica" : "kartice/kartica"}, cijena po provjeri prava.
                </Typography>
              </Paper>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 800, fontSize: "1.25rem" }}>
          {ukupno.toFixed(2)} EUR
        </Typography>
        <Box>
          <Button onClick={onClose} sx={{ mr: 1 }}>ODUSTANI</Button>
          <Button
            variant="contained"
            color="success"
            disabled={!mozePotvrditi}
            onClick={potvrdi}
          >
            {otocnaKolicina > 0 && !imaKarata ? "SKENIRAJ OTOČNE" : "DODAJ POVRATAK"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
