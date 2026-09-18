import { Alert, Box, Card, CardActionArea, Stack, Typography } from "@mui/material";
import DevicesIcon from "@mui/icons-material/Devices";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { authSliceData } from "../auth/authSlice";

// Modul "Administracija" — NE dodjeljuje se korisnicima (nije u katalogu ni u
// popisu prava), vidi ga samo korisnik nfilipec. Ista provjera stoji na tile-u
// na naslovnici i ovdje.
const ADMIN_USER = "nfilipec";
const ACCENT = "#0D9488";

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
                            bgcolor: "rgba(13,148,136,0.10)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Icon sx={{ color: ACCENT, fontSize: 28 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={700} fontSize={15} noWrap>{title}</Typography>
                        {subtitle && (
                            <Typography variant="caption" color="text.secondary" noWrap>{subtitle}</Typography>
                        )}
                    </Box>
                </Stack>
            </CardActionArea>
        </Card>
    );
}

export default function AdminPage() {
    const navigate = useNavigate();
    const authData = useSelector(authSliceData);

    if (authData?.loggedUserData?.username !== ADMIN_USER) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="error">Pristup je ograničen.</Alert>
            </Box>
        );
    }

    const tiles = [
        {
            title: "Desktop verzije",
            subtitle: "Objava i pregled verzija desktop aplikacije",
            icon: DevicesIcon,
            path: "/desk_updater",
        },
    ];

    return (
        <Box sx={{ width: "100%", maxWidth: 1400 }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h5" fontWeight={800}>Administracija</Typography>
                <Typography variant="body2" color="text.secondary">Sustavske radnje dostupne administratoru</Typography>
            </Box>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: 2,
                }}
            >
                {tiles.map((tile, i) => (
                    <TileCard key={i} icon={tile.icon} title={tile.title} subtitle={tile.subtitle} onClick={() => navigate(tile.path)} />
                ))}
            </Box>
        </Box>
    );
}
