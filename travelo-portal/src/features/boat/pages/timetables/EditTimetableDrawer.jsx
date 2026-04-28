import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Modal,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import { useT } from "../../../../i18n/useT";
import EditTimetableRouteSummaryDrawer from "./EditTimetableRouteSummaryDrawer";
import EditTimetablePricesDrawer from "./EditTimetablePricesDrawer";
import { useDispatch, useSelector } from "react-redux";
import { boatSliceData, postBoatThunk, setBoatData } from "../../boatSlice";
import { setAuthData } from "../../../auth/authSlice";

export default function EditTimetableDrawer({ selectedRow, setSelectedRow }) {
  const dispatch = useDispatch()
  const boatData = useSelector(boatSliceData)
  const steps = ["Relacija", "Cijene"];
  const [activeStep, setActiveStep] = useState(0);
  const { t } = useT();
  const [rowsDepartures, setRowsDepartures] = useState([]);

  const updateDeparture = async()=>{
     await dispatch(
        setBoatData({ path: "editData/departuresForTimetable", value:rowsDepartures}),
      )
  }

  useEffect(()=>{
    updateDeparture()
  },[rowsDepartures])

   const createPairsForPrices = async()=>{
      const uniqueHarbor = boatData.boatData?.timetable_details?.departures?.filter(
        (v, i, a) =>
          a.findIndex((t) => t.departure_harbor_id === v.departure_harbor_id) ===
          i,
      );
      let pairs = [];
      let counter = 0;
      if(uniqueHarbor){
      for (const har of uniqueHarbor) {
        const higherIndex = uniqueHarbor.filter((hi) => hi.id > har.id);
        for (const high of higherIndex) {
          counter = counter + 1;
          const newPair = {
            id: counter,
            harbor_from: har.departure_harbor_name,
            harbor_from_code: har.departure_harbor_id,
            harbor_to: high.departure_harbor_name,
            harbor_to_code: high.departure_harbor_id,
            vat_base: 0,
            vat_amount: 0,
            port_tax: 0,
            price: 0,
          };
          pairs = [...pairs, newPair];
        }
      }
      await dispatch(
        setBoatData({ path: "editData/pairsForTimetable", value: pairs }),
      );}
      await dispatch(
        setBoatData({ path: "editData/timetablePrices", value:boatData.boatData?.timetable_details?.prices }),
      )
      await dispatch(
        setBoatData({ path: "editData/departuresForTimetable", value:boatData.boatData?.timetable_details?.departures }),
      )
  }

  const setEditData = async()=>{
      await createPairsForPrices()
  }

  useEffect(()=>{
    setEditData()
  },[])

  const handleNext = async () => {
    console.log(activeStep);
    if (activeStep === 0) {
      
      setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
    } else if (activeStep === 1) {
      await dispatch(setAuthData({ path: "loading", value: true }));
      await dispatch(setAuthData({ path: "loadingMessage", value: "Ažuriranje polaska" }),);
      await dispatch(
        postBoatThunk({ path: "timetables", data: boatData.editData }),
      );
      await dispatch(
        postBoatThunk({ path: "timetable_details", data: boatData.editData.timetableData }),
      );
      setSelectedRow(null)
      await dispatch(setAuthData({ path: "loading", value: false }));
    }
  };

  const handleBack = () => {
    console.log(activeStep);
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  return (
    <>
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
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">
              {t("boat.timetables.edit_title")} {selectedRow?.name}
            </Typography>
            <Button onClick={() => setSelectedRow(null)}>
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
            {activeStep === 0 ? <EditTimetableRouteSummaryDrawer rowsDepartures={rowsDepartures} setRowsDepartures={setRowsDepartures}  />:''}
            {activeStep === 1 ? <EditTimetablePricesDrawer />:''}
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
    </>
  );
}
