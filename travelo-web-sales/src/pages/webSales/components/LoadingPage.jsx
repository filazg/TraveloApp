import { LinearProgress, Stack } from "@mui/material";
import { useT } from "../../../i18n/useT";

export default function LoadingPage({ waitingTickets = false }) {
  const { t } = useT();

  if (waitingTickets) {
    return (
      <Stack sx={{ width: "100%", color: "grey.500", p: 3 }} spacing={2}>
        {t("loading.generating_tickets")}
        <LinearProgress color="primary" />
        <LinearProgress color="primary" />
      </Stack>
    );
  }

  return (
    <Stack sx={{ width: "100%", color: "grey.500", p: 3 }} spacing={2}>
      {t("loading.title")}
      <LinearProgress color="primary" />
      <LinearProgress color="primary" />
      <LinearProgress color="primary" />
    </Stack>
  );
}
