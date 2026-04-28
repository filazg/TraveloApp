import { Box, Card, CardActionArea, Stack, Typography } from "@mui/material";
import { useT } from "../../i18n/useT";
import RouteIcon from '@mui/icons-material/Route';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import DirectionsBoatIcon from '@mui/icons-material/DirectionsBoat';
import RecentActorsIcon from '@mui/icons-material/RecentActors';
import SailingIcon from '@mui/icons-material/Sailing';
import AnchorIcon from '@mui/icons-material/Anchor';
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setAuthData } from "../auth/authSlice";

const ACCENT = "#175BD0";

function TileCard({ icon: Icon, title, subtitle, onClick }) {
    return (
        <Card
            variant="outlined"
            sx={{
                width: 300,
                minHeight: 96,
                borderRadius: 2,
                borderColor: "rgba(15,23,42,0.08)",
                transition: "all .15s ease",
                position: "relative",
                overflow: "hidden",
                "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
                    borderColor: ACCENT,
                },
                "&::before": {
                    content: '""',
                    position: "absolute",
                    left: 0, top: 0, bottom: 0,
                    width: 6,
                    background: ACCENT,
                },
            }}
        >
            <CardActionArea onClick={onClick} sx={{ height: "100%", pl: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 2, py: 1.5 }}>
                    <Box
                        sx={{
                            width: 48, height: 48,
                            borderRadius: 1.5,
                            bgcolor: "rgba(23,91,208,0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Icon sx={{ color: ACCENT, fontSize: 28 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={700} fontSize={15} noWrap>
                            {title}
                        </Typography>
                        {subtitle && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                </Stack>
            </CardActionArea>
        </Card>
    );
}

export default function BoatPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { t } = useT();

    const go = (path) => () => {
        dispatch(setAuthData({ path: "loadingMessage", value: "Povezivanje na poslužitelj" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        navigate(path);
    };

    const tiles = [
        { title: t("boat.lines.title"), subtitle: "Popis linija", icon: RouteIcon, path: "/boat/lines" },
        { title: t("boat.timetables.title"), subtitle: "Plovidbeni redovi", icon: PendingActionsIcon, path: "/boat/timetables" },
        { title: t("boat.boats.title"), subtitle: "Brodovi", icon: DirectionsBoatIcon, path: "/boat/boats" },
        { title: t("boat.tickets_types.title"), subtitle: "Tipovi karata", icon: RecentActorsIcon, path: "/boat/tickets_types" },
        { title: t("boat.harbors.title"), subtitle: "Popis luka", icon: SailingIcon, path: "/boat/harbors" },
        { title: t("boat.regions.title"), subtitle: "Šifarnik lučkih uprava", icon: AnchorIcon, path: "/boat/regions" },
    ];

    return (
        <Box sx={{ width: "100%", maxWidth: 1400 }}>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: 2,
                }}
            >
                {tiles.map((t, i) => (
                    <TileCard
                        key={i}
                        icon={t.icon}
                        title={t.title}
                        subtitle={t.subtitle}
                        onClick={go(t.path)}
                    />
                ))}
            </Box>
        </Box>
    );
}
