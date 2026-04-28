import { Button, Grid, Typography } from "@mui/material";
import { useDispatch } from "react-redux";
import { setStatus } from "../../webSalesSlice";
import { useT } from "../../../i18n/useT";

export default function SelectTripsComponent() {
  const dispatch = useDispatch();
  const { t } = useT();

  const handleSelectTrips = () => {
    dispatch(setStatus({ path: "selectTicketType", value: true }));
  };

  return (
    <Grid size={12}>
      <Grid container direction="row" spacing={2} mt={2}>
        <Grid size={12}>
          <Button
            variant="contained"
            fullWidth
            sx={{ height: 60 }}
            onClick={handleSelectTrips}
          >
            <Typography color="white" variant="h5">
              {t("search.select_trips")}
            </Typography>
          </Button>
        </Grid>
      </Grid>
    </Grid>
  );
}
