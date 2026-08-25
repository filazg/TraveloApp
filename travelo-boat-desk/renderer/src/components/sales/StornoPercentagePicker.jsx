import { Box, Button, Modal, Typography } from "@mui/material";
import { useCallback, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { allAppData } from "../../store/appSlice";

const modalStyle = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "50%",
    maxHeight: "90vh",
    overflowY: "auto",
    bgcolor: "background.paper",
    border: "2px solid #000",
    boxShadow: 24,
    p: 4,
};

// Odabir postotka povrata pri storniranju. Postotci dolaze iz šifarnika koji se
// održava u portalu i stiže sinkom (isto kao na mobilnoj) — slobodan upis ne
// postoji, blagajnik bira jednu od dopuštenih vrijednosti.
//
// Koriste ga oba puta storna (račun i pojedina karta), pa je izdvojen u
// zasebnu komponentu umjesto da se logika duplicira.
export function useStornoPercentagePicker() {
    const appData = useSelector(allAppData);
    const [open, setOpen] = useState(false);
    const [context, setContext] = useState({ label: "", amount: 0 });
    const resolverRef = useRef(null);

    const percentages = (appData.basicData?.storno_percentages || [])
        .filter((p) => p && p.is_active !== false)
        .map((p) => ({
            uuid: p.uuid,
            value: Number(p.percentage),
            label: `${String(Number(p.percentage)).replace(/\.0+$/, "")} %`,
            name: p.name || "",
        }))
        .filter((p) => Number.isFinite(p.value))
        .sort((a, b) => b.value - a.value);

    // Vraća promise koji se razriješi tek kad blagajnik odabere ili odustane.
    const ask = useCallback(({ label, amount } = {}) => {
        setContext({ label: label || "", amount: Number(amount) || 0 });
        setOpen(true);
        return new Promise((resolve) => { resolverRef.current = resolve; });
    }, []);

    const answer = (value) => {
        setOpen(false);
        if (resolverRef.current) {
            resolverRef.current(value == null ? { status: false } : { status: true, value });
            resolverRef.current = null;
        }
    };

    const dialog = (
        <Modal
            open={open}
            onClose={() => answer(null)}
            sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }}
        >
            <Box sx={modalStyle}>
                <Typography variant="h6" component="h2" align="center" sx={{ mb: 1 }}>
                    Postotak povrata
                </Typography>
                <Typography variant="body2" align="center" sx={{ mb: 3 }}>
                    {context.label}
                    {context.amount ? ` · ${context.amount.toFixed(2)} EUR` : ""}
                </Typography>

                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
                    {percentages.map((p) => (
                        <Button
                            key={p.uuid || p.value}
                            variant="contained"
                            sx={{ height: 110, display: "flex", flexDirection: "column", lineHeight: 1.2 }}
                            onClick={() => answer(p.value)}
                        >
                            <Typography variant="h5" component="span" fontWeight="bold">{p.label}</Typography>
                            {context.amount ? (
                                <Typography variant="caption" component="span" sx={{ mt: 0.5 }}>
                                    {((context.amount * p.value) / 100).toFixed(2)} EUR
                                </Typography>
                            ) : null}
                            {p.name ? (
                                <Typography variant="caption" component="span" sx={{ opacity: 0.85, textAlign: "center" }}>
                                    {p.name}
                                </Typography>
                            ) : null}
                        </Button>
                    ))}
                </Box>

                <Button fullWidth variant="outlined" sx={{ mt: 3, height: 56 }} onClick={() => answer(null)}>
                    Odustani
                </Button>
            </Box>
        </Modal>
    );

    return { ask, dialog, percentages };
}
