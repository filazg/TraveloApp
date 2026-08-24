import { Box, Card, CardActionArea, Stack, Typography } from "@mui/material";
import { useT } from "../../i18n/useT";
import BusinessIcon from "@mui/icons-material/Business";
import StoreIcon from "@mui/icons-material/Store";
import DevicesIcon from "@mui/icons-material/Devices";
import GroupIcon from "@mui/icons-material/Group";
import HandshakeIcon from "@mui/icons-material/Handshake";
import PaymentsIcon from "@mui/icons-material/Payments";
import ContactsIcon from "@mui/icons-material/Contacts";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import PublicIcon from "@mui/icons-material/Public";
import PercentIcon from "@mui/icons-material/Percent";
import StorefrontIcon from "@mui/icons-material/Storefront";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setAuthData } from "../auth/authSlice";

const ACCENT = "#0D9488"; // teal

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

export default function BackofficePage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { t } = useT();

    const go = (path) => () => {
        dispatch(setAuthData({ path: "loadingMessage", value: "Povezivanje na poslužitelj" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        navigate(path);
    };

    const tiles = [
        { title: t("backoffice.company.title"), subtitle: "Podaci tvrtke", icon: BusinessIcon, path: "/backoffice/company" },
        { title: t("backoffice.business_premises.title"), subtitle: "Poslovni prostori", icon: StoreIcon, path: "/backoffice/business_premises" },
        { title: t("backoffice.billing_devices.title"), subtitle: "Naplatni uređaji", icon: DevicesIcon, path: "/backoffice/billing_devices" },
        { title: t("backoffice.users.title"), subtitle: "Korisnici sustava", icon: GroupIcon, path: "/backoffice/users" },
        { title: t("backoffice.partners.title"), subtitle: "Partneri", icon: HandshakeIcon, path: "/backoffice/partners" },
        { title: t("backoffice.payment_methods.title"), subtitle: "Načini plaćanja", icon: PaymentsIcon, path: "/backoffice/payment_methods" },
        { title: t("backoffice.addressbook.title"), subtitle: "Adresar kupaca", icon: ContactsIcon, path: "/backoffice/addressbook" },
        { title: t("backoffice.holidays.title"), subtitle: "Praznici", icon: EditCalendarIcon, path: "/backoffice/holidays" },
        { title: t("backoffice.countries.title"), subtitle: "Šifarnik država", icon: PublicIcon, path: "/backoffice/countries" },
        { title: "Postotci storniranja", subtitle: "Ponuđeni postotci pri povratu", icon: PercentIcon, path: "/backoffice/storno_percentages" },
        { title: "Web prodaja", subtitle: "Postavke izdavanja računa", icon: StorefrontIcon, path: "/backoffice/web_sales_settings" },
        { title: "Partnerska prodaja", subtitle: "Postavke izdavanja računa", icon: HandshakeIcon, path: "/backoffice/partner_sales_settings" },
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
                {tiles.map((tile, i) => (
                    <TileCard
                        key={i}
                        icon={tile.icon}
                        title={tile.title}
                        subtitle={tile.subtitle}
                        onClick={go(tile.path)}
                    />
                ))}
            </Box>
        </Box>
    );
}
