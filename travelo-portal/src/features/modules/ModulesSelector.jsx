import { Box, Card, CardActionArea, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { authSliceData, setAuthData } from "../auth/authSlice";
import { iconsMap } from "../../helpers/iconsMap";

// Per-module gradient; falls back to neutral blue for unknown acr.
const GRADIENT_BY_ACR = {
    TRAD: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)",
    SALE: "linear-gradient(135deg,#4568dc 0%,#b06ab3 100%)",
    DISP: "linear-gradient(135deg,#134e5e 0%,#71b280 100%)",
    KAPETAN: "linear-gradient(135deg,#283048 0%,#859398 100%)",
    BAOF: "linear-gradient(135deg,#ff6a00 0%,#ee0979 100%)",
    FINA: "linear-gradient(135deg,#f46b45 0%,#eea849 100%)",
    MANA: "linear-gradient(135deg,#0ba360 0%,#3cba92 100%)",
    REPO: "linear-gradient(135deg,#11998e 0%,#38ef7d 100%)",
};
const DEFAULT_GRADIENT = "linear-gradient(135deg,#654ea3 0%,#eaafc8 100%)";

function ModuleCard({ m, disabled, onClick }) {
    const Icon = iconsMap[m.icon];
    const gradient = disabled
        ? "linear-gradient(135deg,#94a3b8 0%,#cbd5e1 100%)"
        : GRADIENT_BY_ACR[m.acr] || DEFAULT_GRADIENT;

    return (
        <Card
            sx={{
                width: "100%",
                height: 190,
                borderRadius: 4,
                background: gradient,
                position: "relative",
                overflow: "hidden",
                boxShadow: disabled ? "none" : "0 10px 30px rgba(15,23,42,0.16)",
                transition: "all .25s ease",
                opacity: disabled ? 0.55 : 1,
                "&:hover": disabled ? {} : {
                    transform: "translateY(-4px) scale(1.01)",
                    boxShadow: "0 18px 40px rgba(15,23,42,0.24)",
                },
                "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(ellipse at top left, rgba(255,255,255,0.35), transparent 60%)",
                    pointerEvents: "none",
                },
                "&::after": {
                    content: '""',
                    position: "absolute",
                    right: -40, bottom: -40,
                    width: 180, height: 180, borderRadius: "50%",
                    background: "rgba(255,255,255,0.10)",
                    pointerEvents: "none",
                },
            }}
        >
            <CardActionArea disabled={disabled} onClick={onClick} sx={{ height: "100%" }}>
                <Stack direction="row" alignItems="center" spacing={2.5} sx={{ height: "100%", px: 3, position: "relative", zIndex: 1 }}>
                    <Box
                        sx={{
                            width: 84, height: 84,
                            borderRadius: 3,
                            backdropFilter: "blur(8px)",
                            background: "rgba(255,255,255,0.22)",
                            border: "1px solid rgba(255,255,255,0.35)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
                            flexShrink: 0,
                        }}
                    >
                        {Icon && <Icon sx={{ color: "white", fontSize: 46 }} />}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                            sx={{
                                color: "white",
                                fontWeight: 900,
                                fontSize: 26,
                                lineHeight: 1.1,
                                textShadow: "0 1px 2px rgba(0,0,0,0.22)",
                            }}
                        >
                            {m.title}
                        </Typography>
                        {m.subtitle && (
                            <Typography sx={{ color: "rgba(255,255,255,0.9)", fontSize: 14, mt: 0.5 }}>
                                {m.subtitle}
                            </Typography>
                        )}
                    </Box>
                </Stack>
            </CardActionArea>
        </Card>
    );
}

export default function ModulesSelector() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const authData = useSelector(authSliceData);

    const isDisabled = (m) => {
        const isOk = authData?.loggedUserData?.permissions?.find((perm) => perm.module_acr === m.acr);
        return !isOk;
    };

    const handleClick = (m) => () => {
        dispatch(setAuthData({ path: "selectedFeature", value: m }));
        navigate(m.path);
    };

    const transport = authData.transportmodulesData || [];
    const basic = authData.basicModulesData || [];

    return (
        <Box sx={{ width: { xs: "100%", md: "90%", xl: "70%" }, mt: 5 }}>
            {transport.length > 0 && (
                <>
                    <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 1.5 }}>
                        TRANSPORT
                    </Typography>
                    <Box
                        sx={{
                            mt: 1,
                            mb: 4,
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
                            gap: 2.5,
                        }}
                    >
                        {transport.map((m) => (
                            <ModuleCard key={m.acr} m={m} disabled={isDisabled(m)} onClick={handleClick(m)} />
                        ))}
                    </Box>
                </>
            )}

            {basic.length > 0 && (
                <>
                    <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 1.5 }}>
                        OSNOVNO
                    </Typography>
                    <Box
                        sx={{
                            mt: 1,
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
                            gap: 2.5,
                        }}
                    >
                        {basic.map((m) => (
                            <ModuleCard key={m.acr} m={m} disabled={isDisabled(m)} onClick={handleClick(m)} />
                        ))}
                    </Box>
                </>
            )}
        </Box>
    );
}
