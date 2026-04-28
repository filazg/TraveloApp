import { Box, Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AssessmentIcon from "@mui/icons-material/Assessment";
import HandshakeIcon from "@mui/icons-material/Handshake";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import AnchorIcon from "@mui/icons-material/Anchor";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setAuthData } from "../auth/authSlice";

const ACCENT = "#EFBA3E";

function TileCard({ icon: Icon, title, subtitle, enabled, onClick }) {
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
                opacity: enabled ? 1 : 0.55,
                "&:hover": enabled ? {
                    transform: "translateY(-2px)",
                    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
                    borderColor: ACCENT,
                } : {},
                "&::before": {
                    content: '""',
                    position: "absolute",
                    left: 0, top: 0, bottom: 0,
                    width: 6,
                    background: ACCENT,
                },
            }}
        >
            <CardActionArea disabled={!enabled} onClick={onClick} sx={{ height: "100%", pl: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 2, py: 1.5 }}>
                    <Box
                        sx={{
                            width: 48, height: 48,
                            borderRadius: 1.5,
                            bgcolor: "rgba(239,186,62,0.14)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Icon sx={{ color: ACCENT, fontSize: 28 }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography fontWeight={700} fontSize={15} noWrap>
                                {title}
                            </Typography>
                            {!enabled && (
                                <Chip label="uskoro" size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                            )}
                        </Stack>
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

const CARDS = [
    { label: "Računi", subtitle: "Izdani računi", icon: ReceiptLongIcon, path: "/finance/invoices", enabled: true },
    { label: "Partner računi", subtitle: "Fakture partnerima", icon: HandshakeIcon, path: "/finance/partner_invoices", enabled: true },
    { label: "Pregled karata", subtitle: "Sve prodane karte", icon: ConfirmationNumberIcon, path: "/finance/tickets", enabled: true },
    { label: "Lučke uprave", subtitle: "Izvještaj naplata luka", icon: AnchorIcon, path: "/finance/harbor_tax_report", enabled: true },
    { label: "Smjene", subtitle: "Zaključci smjena", icon: AccessTimeIcon, path: "/finance/shifts", enabled: true },
    { label: "Izvještaji", subtitle: "Ostali izvještaji", icon: AssessmentIcon, path: "/finance/reports", enabled: false },
];

export default function FinancePage() {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(setAuthData({ path: "loading", value: false }));
    }, [dispatch]);

    const handleClick = (c) => () => {
        if (!c.enabled) return;
        dispatch(setAuthData({ path: "loadingMessage", value: "Povezivanje na poslužitelj" }));
        dispatch(setAuthData({ path: "loading", value: true }));
        navigate(c.path);
    };

    return (
        <Box sx={{ width: "100%", maxWidth: 1400 }}>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: 2,
                }}
            >
                {CARDS.map((c) => (
                    <TileCard
                        key={c.label}
                        icon={c.icon}
                        title={c.label}
                        subtitle={c.subtitle}
                        enabled={c.enabled}
                        onClick={handleClick(c)}
                    />
                ))}
            </Box>
        </Box>
    );
}
