import {
  Box,
  Button,
  Chip,
  Drawer,
  MenuItem,
  Modal,
  Stack,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import {
  boatSliceData,
  getBoatThunk,
  postBoatThunk,
  setBoatData,
} from "../../boatSlice";
import { setAuthData } from "../../../auth/authSlice";
import React, { useEffect, useRef, useState } from "react";
import { useT } from "../../../../i18n/useT";
import { DataGrid } from "@mui/x-data-grid";
import AddTimetablesRoutesDrawer from "./AddTimetableRoutesDrawer";
import AddTimetablesPricesDrawer from "./AddTimetablePricesDrawer";
import AddTimetableRoutesSummaryDrawer from "./AddTimetableRoutesSummaryDrawer";
import ImportTimetableExcelDrawer from "./ImportTimetableExcelDrawer";
import { backofficeSliceData } from "../../../backoffice/backofficeSlice";
import { v4 as uuid } from "uuid";
import EditTimetableDrawer from "./EditTimetableDrawer";
import GridHint from "../../../../helpers/GridHint";
import { inactiveRowClass } from "../../../../helpers/gridRowActions";
import { buildHarborPairs } from "./harborPairs";

export default function TimetablesPage() {
  const dispatch = useDispatch();
  const backofficeData = useSelector(backofficeSliceData);
  const boatData = useSelector(boatSliceData);
  const { t } = useT();

  const [selectedRow, setSelectedRow] = useState(null);
  const [openAdd, setOpenAdd] = useState(false);
  const steps = ["Unos relacija", "Pregled relacija", "Cijene"];
  const [activeStep, setActiveStep] = useState(0);
  const [addMode, setAddMode] = useState("manual"); // "manual" | "excel"
  const [selectedLine, setSelectedLine] = useState({});
  const [selectedTimetables, setSelectedTimetables] = useState({});

  const [rowToActivate, setRowsToActivate] = useState(null);
  const getInitialNewData = () => ({
    date_from: new Date().toUTCString(),
    days: {
      pon: false,
      uto: false,
      sri: false,
      cet: false,
      pet: false,
      sub: false,
      ned: false,
      pra: false,
    },
    departures: [],
  });
  const [newData, setNewData] = useState(getInitialNewData());

  const resetAddForm = () => {
    setNewData(getInitialNewData());
    setActiveStep(0);
    setAddMode("manual");
    dispatch(
      setBoatData({
        path: "newData",
        value: {
          timetableData: {},
          departuresForTimetable: [],
          harborPairsForTimetable: [],
          pairsForTimetable: [],
          timetablePrices: [],
        },
      }),
    );
  };

  const closeAddDrawer = () => {
    setOpenAdd(false);
    resetAddForm();
  };

  const syncData = async () => {
    await dispatch(setAuthData({ path: "loading", value: true }));
    await dispatch(
      setAuthData({
        path: "loadingMessage",
        value: "Preuzimanje podataka o plovidbenim redovima",
      }),
    );
    await dispatch(getBoatThunk({ path: "timetables" }));
    await dispatch(getBoatThunk({ path: "harbors" }));
    await dispatch(getBoatThunk({ path: "lines" }));
    await dispatch(getBoatThunk({ path: "tickets_types" }));
    await dispatch(getBoatThunk({ path: "boats" }));
    await dispatch(setAuthData({ path: "loading", value: false }));
  };

  useEffect(() => {
    syncData();
  }, []);

  const columns = [
    {
      field: "line_code",
      headerName: t("boat.timetables.timetable_line_code"),
      flex: 3,
    },
    {
      field: "line_name",
      headerName: t("boat.timetables.timetable_line_name"),
      flex: 3,
    },
    { field: "code", headerName: t("boat.timetables.timetable_code"), flex: 3 },
    { field: "name", headerName: t("boat.timetables.timetable_name"), flex: 3 },
    {
      field: "is_active",
      headerName: t("boat.timetables.timetable_is_active"),
      flex: 3,
      renderCell: (params) => {
        const active = params.value;

        return (
          <Box
            sx={{
              width: "100%",
              textAlign: "center",
              fontWeight: 600,
              color: active ? "#1b5e20" : "#b71c1c",
              backgroundColor: active ? "#c8e6c9" : "#ffcdd2", 
              
            }}
          >
            {active ? "Aktivan" : "Deaktivan"}
          </Box>
        );
      }
    },
  ];

 

  const createDeparture = async () => {
    let datesForDepartures = [];
    const startDate = new Date(newData.date_from);
    const endDate = new Date(newData.date_to);
    let dates = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    for (const newDate of dates) {
      const dateForHoliday =
        newDate.getDate() +
        "/" +
        (newDate.getMonth() + 1) +
        "/" +
        newDate.getFullYear();
      const isHoliday = backofficeData?.holidays?.find(
        (day) => day.holiday_date === dateForHoliday,
      );
      if (newData.days.pra && isHoliday) {
        datesForDepartures = [...datesForDepartures, newDate];
      } else if (!newData.days.pra && isHoliday) {
        datesForDepartures = datesForDepartures;
      } else if (newData.days.pon && newDate.getDay() == 1) {
        datesForDepartures = [...datesForDepartures, newDate];
      } else if (newData.days.uto && newDate.getDay() == 2) {
        datesForDepartures = [...datesForDepartures, newDate];
      } else if (newData.days.sri && newDate.getDay() == 3) {
        datesForDepartures = [...datesForDepartures, newDate];
      } else if (newData.days.cet && newDate.getDay() == 4) {
        datesForDepartures = [...datesForDepartures, newDate];
      } else if (newData.days.pet && newDate.getDay() == 5) {
        datesForDepartures = [...datesForDepartures, newDate];
      } else if (newData.days.sub && newDate.getDay() == 6) {
        datesForDepartures = [...datesForDepartures, newDate];
      } else if (newData.days.ned && newDate.getDay() == 0) {
        datesForDepartures = [...datesForDepartures, newDate];
      }
    }
    let departuresDataForAdd = [];
    let sequence = 0;
    let direction = "A";
    let idToAdd = 1;

    const timetableData = {
      uuid: uuid(),
      code: newData.code,
      name: newData.name,
      line_uuid: newData.line.uuid,
      line_code: newData.line.code,
      line_name: newData.line.name,
      is_active: false,
    };

    let order = 10;
    const lineData = boatData.boatData.lines.find(
      (line) => line.uuid === newData.line.uuid,
    );

    // Kapaciteti se vode po polasku, pa moraju pratiti plovilo tog retka.
    const boatFieldsFor = (boatUuid) => {
      const boat =
        (boatUuid && (boatData.boatData.boats || []).find((b) => b.uuid === boatUuid)) ||
        newData.boat;
      return {
        boat_uuid: boat.uuid,
        capacity: boat.capacity,
        vip_capacity: boat.vip_capacity,
        pets_capacity: boat.pets_capacity,
        bicycle_capacity: boat.bicycle_capacity,
      };
    };

    for (const departureData of datesForDepartures) {
      for (const dep of newData.departures) {
        const departure =
          departureData.getDate() +
          "." +
          (departureData.getMonth() + 1) +
          "." +
          departureData.getFullYear() +
          ". " +
          dep.harbor_from_time;
        const arrival =
          departureData.getDate() +
          "." +
          (departureData.getMonth() + 1) +
          "." +
          departureData.getFullYear() +
          ". " +
          dep.harbor_to_time;

        if (lineData.first_harbor_id === dep.harbor_from_uuid) {
          direction = "A";
          sequence = sequence + 1;
          order = 10;
        } else if (lineData.last_harbor_id === dep.harbor_from_uuid) {
          direction = "B";
          sequence = sequence + 1;
          order = 10;
        }

        const addDeparture = {
          id: idToAdd,
          departure_uuid: uuid(),
          timetable_uuid: timetableData.uuid,
          line_uuid: timetableData.line_uuid,
          line_code: timetableData.line_code,
          line_name: timetableData.line_name,
          sequence: sequence,
          voyage_id: "",
          departure_harbor_id: dep.harbor_from_code,
          departure_harbor_name: dep.harbor_from,
          arrival_harbor_id: dep.harbor_to_code,
          arrival_harbor_name: dep.harbor_to,
          departure_planed: departure,
          departure: departure,
          arrival_planed: arrival,
          arrival: arrival,
          harbor_order: order,
          direction: direction,
          // Plovilo po relaciji ako je u koraku "Unos relacija" promijenjeno,
          // inače ono odabrano za cijeli plovidbeni red.
          ...boatFieldsFor(dep.boat_uuid),
          ret_koef: 100,
          is_active: false,
        };
        order = order + 10;
        idToAdd = idToAdd + 1;

        departuresDataForAdd = [...departuresDataForAdd, addDeparture];
      }
    }
    await dispatch(
      setBoatData({ path: "newData/timetableData", value: timetableData }),
    );
    await dispatch(
      setBoatData({
        path: "newData/departuresForTimetable",
        value: departuresDataForAdd,
      }),
    );
    const uniqueHarbor = departuresDataForAdd.filter(
      (v, i, a) =>
        a.findIndex((t) => t.departure_harbor_id === v.departure_harbor_id) ===
        i,
    );
    const pairs = buildHarborPairs(uniqueHarbor);
    await dispatch(
      setBoatData({ path: "newData/pairsForTimetable", value: pairs }),
    );
  };

  const createDepartureFromExcel = async () => {
    const lineData = boatData.boatData.lines.find(
      (line) => line.uuid === newData.line.uuid,
    );
    const harborByCode = (code) =>
      (boatData.boatData?.harbors || []).find(
        (h) => String(h.code) === String(code),
      );
    const timetableData = {
      uuid: uuid(),
      code: newData.code,
      name: newData.name,
      line_uuid: newData.line.uuid,
      line_code: newData.line.code,
      line_name: newData.line.name,
      is_active: false,
    };
    let departuresDataForAdd = [];
    let sequence = 0;
    let direction = "A";
    let order = 10;
    let idToAdd = 1;

    const pad2 = (n) => String(n).padStart(2, "0");
    const fmt = (dt) =>
      `${dt.getDate()}.${dt.getMonth() + 1}.${dt.getFullYear()}. ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;

    for (const r of newData.excelRows || []) {
      const fromHarbor = harborByCode(r.depCode);
      const fromUuid = fromHarbor?.uuid;
      const toHarbor = harborByCode(r.arrCode);
      const toUuid = toHarbor?.uuid;
      if (fromUuid && fromUuid === lineData.first_harbor_id) {
        direction = "A";
        sequence = sequence + 1;
        order = 10;
      } else if (fromUuid && fromUuid === lineData.last_harbor_id) {
        direction = "B";
        sequence = sequence + 1;
        order = 10;
      }
      departuresDataForAdd = [
        ...departuresDataForAdd,
        {
          id: idToAdd,
          departure_uuid: uuid(),
          timetable_uuid: timetableData.uuid,
          line_uuid: timetableData.line_uuid,
          line_code: timetableData.line_code,
          line_name: timetableData.line_name,
          sequence,
          voyage_id: r.voyageId || "",
          departure_harbor_id: r.depCode,
          departure_harbor_name: r.depName || fromHarbor?.name,
          arrival_harbor_id: r.arrCode,
          arrival_harbor_name: r.arrName || toHarbor?.name,
          departure_planed: fmt(r.etd),
          departure: fmt(r.etd),
          arrival_planed: fmt(r.eta),
          arrival: fmt(r.eta),
          harbor_order: order,
          direction,
          boat_uuid: newData.boat.uuid,
          capacity: newData.boat.capacity,
          vip_capacity: newData.boat.vip_capacity,
          pets_capacity: newData.boat.pets_capacity,
          bicycle_capacity: newData.boat.bicycle_capacity,
          ret_koef: 100,
          is_active: false,
        },
      ];
      order = order + 10;
      idToAdd = idToAdd + 1;
    }

    await dispatch(
      setBoatData({ path: "newData/timetableData", value: timetableData }),
    );
    await dispatch(
      setBoatData({
        path: "newData/departuresForTimetable",
        value: departuresDataForAdd,
      }),
    );
    const uniqueHarbor = departuresDataForAdd.filter(
      (v, i, a) =>
        a.findIndex((t) => t.departure_harbor_id === v.departure_harbor_id) === i,
    );
    const pairs = buildHarborPairs(uniqueHarbor);
    await dispatch(
      setBoatData({ path: "newData/pairsForTimetable", value: pairs }),
    );
  };

  const handleNext = async () => {
    console.log(activeStep);
    if (activeStep === 0) {
      console.log(newData);
      await dispatch(setAuthData({ path: "loading", value: true }));
      await dispatch(
        setAuthData({ path: "loadingMessage", value: "Priprema podataka" }),
      );
      if (addMode === "excel") {
        if (
          newData.line &&
          newData.boat &&
          newData.code &&
          newData.name &&
          Array.isArray(newData.excelRows) &&
          newData.excelRows.length > 0
        ) {
          await dispatch(
            setAuthData({
              path: "loadingMessage",
              value: "Kreiranje polazaka iz Excela",
            }),
          );
          await createDepartureFromExcel();
          setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
        } else {
          alert(
            "Učitajte Excel, popunite oznaku i naziv, te potvrdite liniju, brod i sve luke.",
          );
        }
      } else if (
        newData.line &&
        newData.boat &&
        newData.date_from &&
        newData.date_to &&
        newData.departures.length > 0 &&
        Object.values(newData.days).some((day) => day === true)
      ) {
        await dispatch(
          setAuthData({ path: "loadingMessage", value: "Kreiranje polazaka" }),
        );
        await createDeparture();
        setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
      } else {
        alert("Niste unijeli sve potrebne podatke");
      }
      await dispatch(setAuthData({ path: "loading", value: false }));
    } else if (activeStep === 1) {
      setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
    } else if (activeStep === 2) {
      await dispatch(setAuthData({ path: "loading", value: true }));
      await dispatch(
        setAuthData({ path: "loadingMessage", value: "Spremanje plovidbenog reda" }),
      );
      await dispatch(
        postBoatThunk({ path: "timetables", data: boatData.newData }),
      );
      await dispatch(getBoatThunk({ path: "timetables" }));
      await dispatch(setAuthData({ path: "loading", value: false }));
      closeAddDrawer();
    }
  };

  const handleBack = () => {
    console.log(activeStep);
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleEditRow = async (updatedRow) => {
    console.log("EDITED ROW: ", updatedRow);
    await dispatch(setAuthData({ path: "loading", value: true }));
    await dispatch(
      setAuthData({
        path: "loadingMessage",
        value: "Dohvaćanje detalja plovidbenog reda",
      }),
    );
    await dispatch(
      postBoatThunk({ path: "timetable_details", data: updatedRow }),
    );
    setSelectedRow(updatedRow);
    await dispatch(
        setBoatData({ path: "editData/timetableData", value:updatedRow }),
      )
    await dispatch(setAuthData({ path: "loading", value: false }));
  };

  const clickTimerRef = useRef(null);
  const clickDelay = 250;

  const style = {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 600,
      hight: "75vh",
      bgcolor: "background.paper",
      boxShadow: 24,
      pt: 2,
      px: 4,
      pb: 3,
    };

    const handleActivate = async(status)=>{
      await dispatch(setAuthData({ path: "loading", value: true }));
      let message = 'Deeaktiviranje plovidbenog reda'
      if(status){
        message='Aktiviranje plovidbenog reda'
      }
      await dispatch(setAuthData({ path: "loadingMessage", value: message }));
      setRowsToActivate(null)
      const newTimetableData = { ...rowToActivate, is_active: status };
      const dataToSend = {
        timetableData:newTimetableData
      }
      await dispatch(
        postBoatThunk({ path: "timetables", data: dataToSend }),
      )
      await dispatch(setAuthData({ path: "loading", value: false }));
    }

    const handleTimetablesToShow = async()=>{
      if(selectedLine?.code){
        const filteredTimetables = await boatData?.boatData?.timetables.filter((tt)=>tt.line_code === selectedLine.code)
        setSelectedTimetables(filteredTimetables)
      }else{
        setSelectedTimetables(boatData?.boatData?.timetables)
      }  
        
    }

    useEffect(()=>{
      handleTimetablesToShow()
    },[selectedLine])
    
    useEffect(()=>{
      handleTimetablesToShow()
    },[boatData?.boatData?.timetables])

  return (
    <>
      <Box
        sx={{
          mt: 2,
          ml: 2,
          width: "98%",
          overflowX: "auto",
        }}
      >
        <>
          <TextField
            select
            fullWidth
            label="Odaberi liniju"
            value={selectedLine?.code || ""}
            onChange={(e) => {
              const value = e.target.value;

              if (!value) {
                setSelectedLine(null);
                return;
              }

              const line = boatData.boatData?.lines?.find(
                (l) => l.code === value
              );

              setSelectedLine(line || null);
            }}
            sx={{ my: 2, width: 380 }}
          >
            <MenuItem value="">
              — Bez odabrane linije —
            </MenuItem>

            {boatData.boatData?.lines?.map((line) => (
              <MenuItem key={line.code} value={line.code}>
                {line.name}
              </MenuItem>
            ))}
          </TextField>
          <GridHint />
          <Box
            sx={{
              height: "75vh",
              minWidth: 1200,
            }}
          >
            <DataGrid
              rows={selectedTimetables || []}
              columns={columns}
              getRowId={(row) => row.id}
              getRowClassName={inactiveRowClass()}
              onCellClick={(params) => {
                clearTimeout(clickTimerRef.current);

                clickTimerRef.current = setTimeout(() => {
                  handleEditRow(params.row);
                }, clickDelay);
              }}
              onCellDoubleClick={(params, event) => {
                event.defaultMuiPrevented = true; 
                clearTimeout(clickTimerRef.current);
                setRowsToActivate(params.row)
                console.log("Field:", params.field);
                console.log("Row:", params.row);

              }}
            />
          </Box>  
        </>
      </Box>
      <Drawer
        anchor="right"
        open={openAdd}
        onClose={closeAddDrawer}
        PaperProps={{
          sx: {
            height: "100%",
            maxWidth: "100vw",
            overflow: "auto",
          },
        }}
      >
        <Box
          sx={{
            minWidth: 1500,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              px: 3,
              pt: 2,
              pb: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{ mb: 3 }}
            >
              <Typography variant="h5" fontWeight="bold">
                {t("boat.timetables.add_new_title")}
              </Typography>
              <Button onClick={closeAddDrawer}>
                {t("boat.timetables.close")}
              </Button>
            </Stack>

            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>

          <Box sx={{ flex: 1, overflow: "auto", px: 3, py: 3 }}>
            <Box sx={{ minWidth: 1400 }}>
              {activeStep === 0 && (
                <>
                  <Tabs
                    value={addMode}
                    onChange={(_, v) => setAddMode(v)}
                    sx={{ mb: 2 }}
                  >
                    <Tab value="manual" label="Ručno" />
                    <Tab value="excel" label="Iz Excela" />
                  </Tabs>
                  {addMode === "manual" ? (
                    <AddTimetablesRoutesDrawer
                      newData={newData}
                      setNewData={setNewData}
                    />
                  ) : (
                    <ImportTimetableExcelDrawer
                      newData={newData}
                      setNewData={setNewData}
                    />
                  )}
                </>
              )}

              {activeStep === 1 && <AddTimetableRoutesSummaryDrawer />}
              {activeStep === 2 && <AddTimetablesPricesDrawer />}
            </Box>
          </Box>

          <Box
            sx={{
              px: 3,
              py: 2,
              borderTop: "1px solid",
              borderColor: "divider",
              backgroundColor: "background.paper",
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Button disabled={activeStep === 0} onClick={handleBack}>
                Nazad
              </Button>
              <Button variant="contained" onClick={handleNext}>
                {activeStep === steps.length - 1 ? "Potvrdi" : "Sljedeći"}
              </Button>
            </Stack>
          </Box>
        </Box>
      </Drawer>
      <Drawer
        anchor="right"
        open={selectedRow}
        onClose={() => setSelectedRow(null)}
        PaperProps={{
          sx: {
            height: "100%",
            maxWidth: "100vw",
            overflow: "auto",
          },
        }}
      >
        <EditTimetableDrawer
          selectedRow={selectedRow}
          setSelectedRow={setSelectedRow}
        />
      </Drawer>

      <Stack sx={{ width: "96%", ml: 1 }} alignItems="flex-start">
        <Button onClick={() => setOpenAdd(true)}>
          {t("boat.timetables.add_timetable")}
        </Button>
      </Stack>
      <Modal
         open={rowToActivate} onClose={() => setRowsToActivate(null)}
      >
        <Box sx={{ ...style, width: 300, overflowY: "auto" }}>
          {rowToActivate?.is_active ?
            <>
              <Stack
                justifyContent='center'
                alignItems='centar'
              >
                <Typography textAlign='center'>
                  Želite li deaktivirati plovidbeni red
                </Typography>
                <Button
                  variant='contained'
                  color="error"
                  onClick={()=>handleActivate(false)}
                  sx={{
                    mt:3
                  }}
                  >
                  DEAKTIVIRAJ
                </Button>
              </Stack>
            </>
            :
            <>
              <Stack
                justifyContent='center'
                alignItems='centar'
              >
                <Typography textAlign='center'>
                  Želite li aktivirati plovidbeni red
                </Typography>
                <Button
                  variant='contained'
                  color="success"
                  onClick={()=>handleActivate(true)}
                  sx={{
                    mt:3
                  }}
                  >
                  AKTIVIRAJ
                </Button>
              </Stack>
            </>
          }

        </Box>
      </Modal>
    </>
  );
}
