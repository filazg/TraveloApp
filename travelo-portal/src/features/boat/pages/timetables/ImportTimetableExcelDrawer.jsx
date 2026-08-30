import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as XLSX from "xlsx";
import {
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  boatSliceData,
  getBoatThunk,
  postBoatThunk,
  setBoatData,
} from "../../boatSlice";
import { setAuthData } from "../../../auth/authSlice";

// --- helpers ---------------------------------------------------------------

const pad2 = (n) => String(n).padStart(2, "0");

// Excel cell může biti Date (ako je xlsx učitan s cellDates), broj (Excel serial)
// ili string "03.01.2026 07:00". Vraća Date ili null.
const parseEtdEta = (val) => {
  if (val == null || val === "") return null;
  if (val instanceof Date && !isNaN(val)) return val;
  if (typeof val === "number") {
    // Excel serial → ms
    const ms = Math.round((val - 25569) * 86400 * 1000);
    return new Date(ms);
  }
  if (typeof val === "string") {
    const m = val.match(/^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})\s*$/);
    if (m) {
      const [, d, mo, y, h, mi] = m;
      return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
    }
  }
  return null;
};

// Manual flow koristi format "D.M.YYYY. HH:MM" (bez zero-pada na datumu).
const formatDepartureString = (dt) =>
  `${dt.getDate()}.${dt.getMonth() + 1}.${dt.getFullYear()}. ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;

const HEADER_MAP = {
  voyId: "VoyId Dol",
  depName: "Luka odlaska",
  arrName: "Luka dolaska",
  depCode: "Sifra Lka Odl",
  arrCode: "Sifra Lka Dol",
  tripType: "Tip Putovanja (R-Redovno;B-Balast;I-izvanredno;D-Dodatno)",
  dangerous: "Opasni Teret (D/N)",
  nib: "Poi Nib",
  imo: "Poi Imo",
  note: "Napomena",
  etd: "ETD_",
  eta: "ETA_",
  lineCode: "Broj Linije",
};

// --- component -------------------------------------------------------------

export default function ImportTimetableExcelDrawer({ newData, setNewData }) {
  const dispatch = useDispatch();
  const boatData = useSelector(boatSliceData);
  const fileInputRef = useRef(null);

  const [parseError, setParseError] = useState(null);
  const [parsed, setParsed] = useState(null);
  // parsed = { lineCode, boatImo, boatNib, harborCodes:Set<string>, harborNames:Map<code,name>, rows:[{etd,eta,depCode,depName,arrCode,arrName,voyageId}], skipped }

  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [lineForm, setLineForm] = useState({});
  const [boatFormOpen, setBoatFormOpen] = useState(false);
  const [boatForm, setBoatForm] = useState({});
  const [harborFormCode, setHarborFormCode] = useState(null);
  const [harborForm, setHarborForm] = useState({});

  // -----------------------------------------------------------------------
  // Parsing

  const handleFile = async (file) => {
    setParseError(null);
    setParsed(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sh = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sh, { defval: "" });
      if (!rows.length) throw new Error("Prazna tablica");

      const lineCodes = new Set();
      const imos = new Set();
      const nibs = new Set();
      const harborCodes = new Set();
      const harborNames = new Map();
      const out = [];
      let skipped = 0;
      const now = new Date();

      for (const r of rows) {
        const etd = parseEtdEta(r[HEADER_MAP.etd]);
        const eta = parseEtdEta(r[HEADER_MAP.eta]);
        if (!etd || !eta) continue;
        const depCode = String(r[HEADER_MAP.depCode] || "").trim();
        const arrCode = String(r[HEADER_MAP.arrCode] || "").trim();
        const depName = String(r[HEADER_MAP.depName] || "").trim();
        const arrName = String(r[HEADER_MAP.arrName] || "").trim();
        const lineCode = String(r[HEADER_MAP.lineCode] || "").trim();
        if (!depCode || !arrCode || !lineCode) continue;

        lineCodes.add(lineCode);
        if (r[HEADER_MAP.imo]) imos.add(String(r[HEADER_MAP.imo]).trim());
        if (r[HEADER_MAP.nib]) nibs.add(String(r[HEADER_MAP.nib]).trim());
        harborCodes.add(depCode);
        harborCodes.add(arrCode);
        if (depName) harborNames.set(depCode, depName);
        if (arrName) harborNames.set(arrCode, arrName);

        if (etd < now) {
          skipped += 1;
          continue;
        }
        out.push({
          etd,
          eta,
          depCode,
          depName,
          arrCode,
          arrName,
          voyageId: r[HEADER_MAP.voyId] != null ? String(r[HEADER_MAP.voyId]) : "",
        });
      }

      if (lineCodes.size > 1) {
        throw new Error(
          `Excel sadrži više linija (${[...lineCodes].join(", ")}). Uvoz podržava samo jednu liniju po datoteci.`,
        );
      }
      if (lineCodes.size === 0) throw new Error("Excel ne sadrži ni jedan valjan red.");

      setParsed({
        lineCode: [...lineCodes][0],
        boatImo: imos.size ? [...imos][0] : null,
        boatNib: nibs.size ? [...nibs][0] : null,
        harborCodes: [...harborCodes].sort(),
        harborNames,
        rows: out,
        skipped,
      });
    } catch (e) {
      console.error("Excel parse error:", e);
      setParseError(e.message || "Greška pri učitavanju Excel datoteke.");
    }
  };

  // -----------------------------------------------------------------------
  // Resolution against current boatData

  const lines = boatData.boatData?.lines || [];
  const boats = boatData.boatData?.boats || [];
  const harbors = boatData.boatData?.harbors || [];

  const resolved = useMemo(() => {
    if (!parsed) return null;
    const line = lines.find((l) => String(l.code) === String(parsed.lineCode)) || null;
    let boat = null;
    if (parsed.boatImo)
      boat = boats.find((b) => String(b.imo) === String(parsed.boatImo)) || null;
    if (!boat && parsed.boatNib)
      boat = boats.find((b) => String(b.nib) === String(parsed.boatNib)) || null;
    const harborMap = {};
    const missingHarbors = [];
    for (const code of parsed.harborCodes) {
      const h = harbors.find((x) => String(x.code) === String(code));
      if (h) harborMap[code] = h;
      else missingHarbors.push(code);
    }
    return { line, boat, harborMap, missingHarbors };
  }, [parsed, lines, boats, harbors]);

  // Push resolved line/boat into parent newData when both ready
  useEffect(() => {
    if (!resolved) return;
    const update = {};
    if (resolved.line && newData?.line?.uuid !== resolved.line.uuid) update.line = resolved.line;
    if (resolved.boat && newData?.boat?.uuid !== resolved.boat.uuid) update.boat = resolved.boat;
    if (parsed && newData?.excelRows !== parsed.rows) {
      update.excelRows = parsed.rows;
      update.isExcel = true;
    }
    if (Object.keys(update).length) setNewData({ ...newData, ...update });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, parsed]);

  // -----------------------------------------------------------------------
  // Submit handlers for missing-entity forms

  const refetch = async (path) => {
    await dispatch(getBoatThunk({ path }));
  };

  const submitLine = async () => {
    await dispatch(setAuthData({ path: "loading", value: true }));
    await dispatch(setAuthData({ path: "loadingMessage", value: "Dodavanje linije" }));
    await dispatch(postBoatThunk({ path: "lines", data: lineForm }));
    await refetch("lines");
    setLineFormOpen(false);
    setLineForm({});
    await dispatch(setAuthData({ path: "loading", value: false }));
  };

  const submitBoat = async () => {
    await dispatch(setAuthData({ path: "loading", value: true }));
    await dispatch(setAuthData({ path: "loadingMessage", value: "Dodavanje broda" }));
    await dispatch(postBoatThunk({ path: "boats", data: boatForm }));
    await refetch("boats");
    setBoatFormOpen(false);
    setBoatForm({});
    await dispatch(setAuthData({ path: "loading", value: false }));
  };

  const submitHarbor = async () => {
    await dispatch(setAuthData({ path: "loading", value: true }));
    await dispatch(setAuthData({ path: "loadingMessage", value: "Dodavanje luke" }));
    await dispatch(postBoatThunk({ path: "harbors", data: harborForm }));
    await refetch("harbors");
    setHarborFormCode(null);
    setHarborForm({});
    await dispatch(setAuthData({ path: "loading", value: false }));
  };

  // Open form helpers (prefill from Excel)
  const openLineForm = () => {
    setLineForm({
      code: parsed.lineCode,
      name: "",
      type: "",
      first_harbor_name: "",
      last_harbor_name: "",
    });
    setLineFormOpen(true);
  };
  const openBoatForm = () => {
    setBoatForm({
      name: "",
      imo: parsed.boatImo || "",
      nib: parsed.boatNib || "",
      capacity: "",
      vip_capacity: "",
      pets_capacity: "",
      bicycle_capacity: "",
    });
    setBoatFormOpen(true);
  };
  const openHarborForm = (code) => {
    setHarborForm({
      code,
      name: parsed.harborNames.get(code) || "",
      country: "Hrvatska",
      city: "",
      region: "",
      seop_island: "",
    });
    setHarborFormCode(code);
  };

  // -----------------------------------------------------------------------
  // Common change helper for parent newData (code/name)
  const handleNewDataChange = (e) =>
    setNewData({ ...newData, [e.target.name]: e.target.value });

  const dateRange = useMemo(() => {
    if (!parsed?.rows?.length) return null;
    const dates = parsed.rows.map((r) => r.etd.getTime()).sort((a, b) => a - b);
    return {
      from: new Date(dates[0]),
      to: new Date(dates[dates.length - 1]),
    };
  }, [parsed]);

  // -----------------------------------------------------------------------

  return (
    <Box sx={{ p: 1 }}>
      <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Grid container justifyContent="center" spacing={2}>
          <TextField
            type="text"
            variant="outlined"
            label="Naziv plovidbenog reda"
            placeholder="Naziv plovidbenog reda"
            required
            value={newData.name || ""}
            onChange={handleNewDataChange}
            name="name"
            sx={{ width: 380 }}
          />
          <TextField
            type="text"
            variant="outlined"
            label="Oznaka plovidbenog reda"
            placeholder="Oznaka plovidbenog reda"
            required
            value={newData.code || ""}
            onChange={handleNewDataChange}
            name="code"
            sx={{ width: 380 }}
          />
        </Grid>


        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 4 }}>
          <Button variant="contained" onClick={() => fileInputRef.current?.click()}>
            Odaberi Excel datoteku
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          {parsed && (
            <Typography variant="body2" color="text.secondary">
              {parsed.rows.length} polazaka, preskočeno {parsed.skipped} prošlih
            </Typography>
          )}
        </Stack>

        {parseError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {parseError}
          </Alert>
        )}

        {parsed && resolved && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Sažetak
            </Typography>

            <Stack spacing={1}>
              {/* Line */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ minWidth: 120 }}>Linija:</Typography>
                <Chip
                  label={parsed.lineCode}
                  color={resolved.line ? "success" : "warning"}
                  size="small"
                />
                {resolved.line ? (
                  <Typography variant="body2">{resolved.line.name}</Typography>
                ) : (
                  <Button size="small" variant="outlined" onClick={openLineForm}>
                    Dodaj liniju
                  </Button>
                )}
              </Stack>

              {/* Boat */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ minWidth: 120 }}>Brod:</Typography>
                <Chip
                  label={`IMO ${parsed.boatImo || "-"} / NIB ${parsed.boatNib || "-"}`}
                  color={resolved.boat ? "success" : "warning"}
                  size="small"
                />
                {resolved.boat ? (
                  <Typography variant="body2">{resolved.boat.name}</Typography>
                ) : (
                  <Button size="small" variant="outlined" onClick={openBoatForm}>
                    Dodaj brod
                  </Button>
                )}
              </Stack>

              {/* Harbors */}
              <Box>
                <Typography sx={{ mb: 0.5 }}>Luke:</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {parsed.harborCodes.map((code) => {
                    const h = resolved.harborMap[code];
                    return h ? (
                      <Chip
                        key={code}
                        label={`${code} • ${h.name}`}
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip
                        key={code}
                        label={`${code} • ${parsed.harborNames.get(code) || "?"}`}
                        color="warning"
                        size="small"
                        onClick={() => openHarborForm(code)}
                        clickable
                      />
                    );
                  })}
                </Stack>
                {resolved.missingHarbors.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Klikni na žutu luku da je dodaš.
                  </Typography>
                )}
              </Box>

              {/* Date range */}
              {dateRange && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ minWidth: 120 }}>Raspon:</Typography>
                  <Typography variant="body2">
                    {formatDepartureString(dateRange.from)} – {formatDepartureString(dateRange.to)}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Box>
        )}
      </Paper>

      {/* --- Add line drawer --- */}
      <Drawer
        anchor="right"
        open={lineFormOpen}
        onClose={() => setLineFormOpen(false)}
        PaperProps={{ sx: { width: { xs: "100vw", sm: 520 } } }}
      >
        <Box sx={{ mx: 5, my: 3 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">
              Nova linija
            </Typography>
            <Button onClick={() => setLineFormOpen(false)}>Zatvori</Button>
          </Stack>
          <TextField
            fullWidth
            required
            label="Šifra linije"
            value={lineForm.code || ""}
            onChange={(e) => setLineForm({ ...lineForm, code: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            required
            label="Naziv linije"
            value={lineForm.name || ""}
            onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            select
            required
            label="Početna luka"
            value={lineForm.first_harbor_name || ""}
            onChange={(e) =>
              setLineForm({ ...lineForm, first_harbor_name: e.target.value })
            }
            sx={{ mt: 1 }}
          >
            {harbors.map((h) => (
              <MenuItem key={h.id} value={h}>
                {h.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            select
            required
            label="Završna luka"
            value={lineForm.last_harbor_name || ""}
            onChange={(e) =>
              setLineForm({ ...lineForm, last_harbor_name: e.target.value })
            }
            sx={{ mt: 1 }}
          >
            {harbors.map((h) => (
              <MenuItem key={h.id} value={h}>
                {h.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            select
            required
            label="Tip linije"
            value={lineForm.type || ""}
            onChange={(e) => setLineForm({ ...lineForm, type: e.target.value })}
            sx={{ mt: 1 }}
          >
            {(boatData.boatData?.linesTypes || []).map((t) => (
              <MenuItem key={t.id} value={t}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            onClick={submitLine}
            variant="contained"
            disabled={
              !lineForm.code ||
              !lineForm.name ||
              !lineForm.first_harbor_name ||
              !lineForm.last_harbor_name ||
              !lineForm.type
            }
            sx={{ height: 60, mt: 2, width: "100%" }}
          >
            Spremi liniju
          </Button>
        </Box>
      </Drawer>

      {/* --- Add boat drawer --- */}
      <Drawer
        anchor="right"
        open={boatFormOpen}
        onClose={() => setBoatFormOpen(false)}
        PaperProps={{ sx: { width: { xs: "100vw", sm: 520 } } }}
      >
        <Box sx={{ mx: 5, my: 3 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">
              Novi brod
            </Typography>
            <Button onClick={() => setBoatFormOpen(false)}>Zatvori</Button>
          </Stack>
          <TextField
            fullWidth
            required
            label="Naziv broda"
            value={boatForm.name || ""}
            onChange={(e) => setBoatForm({ ...boatForm, name: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            required
            type="number"
            label="NIB"
            value={boatForm.nib || ""}
            onChange={(e) => setBoatForm({ ...boatForm, nib: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            required
            type="number"
            label="IMO"
            value={boatForm.imo || ""}
            onChange={(e) => setBoatForm({ ...boatForm, imo: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            type="number"
            label="Kapacitet"
            value={boatForm.capacity || ""}
            onChange={(e) => setBoatForm({ ...boatForm, capacity: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            type="number"
            label="VIP kapacitet"
            value={boatForm.vip_capacity || ""}
            onChange={(e) => setBoatForm({ ...boatForm, vip_capacity: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            type="number"
            label="Kapacitet ljubimaca"
            value={boatForm.pets_capacity || ""}
            onChange={(e) => setBoatForm({ ...boatForm, pets_capacity: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            type="number"
            label="Kapacitet bicikala"
            value={boatForm.bicycle_capacity || ""}
            onChange={(e) =>
              setBoatForm({ ...boatForm, bicycle_capacity: e.target.value })
            }
            sx={{ mt: 1 }}
          />
          <Button
            onClick={submitBoat}
            variant="contained"
            disabled={!boatForm.name || !boatForm.nib || !boatForm.imo}
            sx={{ height: 60, mt: 2, width: "100%" }}
          >
            Spremi brod
          </Button>
        </Box>
      </Drawer>

      {/* --- Add harbor drawer --- */}
      <Drawer
        anchor="right"
        open={!!harborFormCode}
        onClose={() => setHarborFormCode(null)}
        PaperProps={{ sx: { width: { xs: "100vw", sm: 520 } } }}
      >
        <Box sx={{ mx: 5, my: 3 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">
              Nova luka
            </Typography>
            <Button onClick={() => setHarborFormCode(null)}>Zatvori</Button>
          </Stack>
          <TextField
            fullWidth
            required
            label="Šifra luke"
            value={harborForm.code || ""}
            onChange={(e) => setHarborForm({ ...harborForm, code: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            required
            label="Naziv luke"
            value={harborForm.name || ""}
            onChange={(e) => setHarborForm({ ...harborForm, name: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            label="Grad"
            value={harborForm.city || ""}
            onChange={(e) => setHarborForm({ ...harborForm, city: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            label="Regija"
            value={harborForm.region || ""}
            onChange={(e) => setHarborForm({ ...harborForm, region: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            label="Država"
            value={harborForm.country || ""}
            onChange={(e) => setHarborForm({ ...harborForm, country: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            label="SEOP otok"
            value={harborForm.seop_island || ""}
            onChange={(e) =>
              setHarborForm({ ...harborForm, seop_island: e.target.value })
            }
            sx={{ mt: 1 }}
          />
          <Button
            onClick={submitHarbor}
            variant="contained"
            disabled={!harborForm.code || !harborForm.name}
            sx={{ height: 60, mt: 2, width: "100%" }}
          >
            Spremi luku
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
}
