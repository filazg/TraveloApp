import { Box, Divider, IconButton, Modal, Paper, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";

const eur = (value) => `${(Number(value) || 0).toFixed(2)} EUR`;

const formatDateTime = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Redak sažetka — oznaka lijevo, vrijednost desno.
function InfoRow({ label, value, bold }) {
    return (
        <Stack direction="row" alignItems="center" sx={{ py: 0.5 }}>
            <Typography
                sx={{ flex: 1, fontWeight: bold ? 800 : 500 }}
                color={bold ? "text.primary" : "text.secondary"}
            >
                {label}
            </Typography>
            <Typography sx={{ fontWeight: bold ? 800 : 600 }} align="right">
                {value}
            </Typography>
        </Stack>
    );
}

// Jedan redak tablice — naziv lijevo, broj računa u sredini, iznos desno.
// Isti raspored koriste i sredstva plaćanja i storno, da se stupci poklope.
function SummaryRow({ name, count, amount, countLabel, bold, muted }) {
    return (
        <Stack direction="row" alignItems="center" sx={{ py: 0.75 }}>
            <Typography
                sx={{ flex: 1, minWidth: 0, fontWeight: bold ? 800 : 500 }}
                color={muted ? "text.secondary" : "text.primary"}
                noWrap
                title={name}
            >
                {name}
            </Typography>
            <Typography
                sx={{ width: 130, fontWeight: bold ? 800 : 500 }}
                color="text.secondary"
                align="right"
            >
                {count == null ? "" : `${count} ${countLabel || ""}`.trim()}
            </Typography>
            <Typography
                sx={{ width: 150, fontWeight: bold ? 800 : 600 }}
                align="right"
            >
                {eur(amount)}
            </Typography>
        </Stack>
    );
}

export default function ShiftSummaryModal() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);

    const details = appData.workingData?.shiftDetails || [];
    const storno = appData.workingData?.shiftStorno || [];
    const stornoAmount = appData.workingData?.shiftStornoAmount || 0;
    const totals = appData.workingData?.shiftTotals || {};
    const shift = appData.workingData?.shiftSummaryFor;

    const total = details.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const invoiceCount = details.reduce((sum, row) => sum + (Number(row.invoice_quantity) || 0), 0);
    const invoiceRange = totals.shift_first_invoice
        ? `${totals.shift_first_invoice} – ${totals.shift_last_invoice}`
        : "–";

    const handleClose = () => {
        dispatch(setStateData({ path: "modalsStates/showShiftSummaryModal", value: false }));
    };

    return (
        <Modal
            open={!!appData.modalsStates.showShiftSummaryModal}
            onClose={handleClose}
            // Otvara se iznad liste smjena, koja je i sama modal.
            sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }}
        >
            <Box
                sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "min(760px, 92vw)",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    // Modal fokusira svoj okvir, pa Chrome oko njega crta focus
                    // ring. MuiDialog isto ovako gasi.
                    outline: "none",
                    bgcolor: "background.default",
                    borderRadius: 3,
                    boxShadow: 24,
                    p: 3,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            Pregled smjene
                        </Typography>
                        {/* Samo operater — trajanje smjene stoji u sažetku ispod,
                            da se isti podatak ne piše dvaput. */}
                        {shift ? (
                            <Typography variant="body2" color="text.secondary">
                                Smjena {shift.id} · {[shift.operater_name, shift.operater_surname].filter(Boolean).join(" ")}
                            </Typography>
                        ) : null}
                    </Box>
                    <IconButton onClick={handleClose}><CloseIcon /></IconButton>
                </Stack>

                {/* Sažetak smjene — isti podaci i isti redoslijed kao u pregledu
                    prije zatvaranja na mobilnoj blagajni. */}
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <InfoRow label="Početak" value={formatDateTime(shift?.shift_start)} />
                    <InfoRow label="Završetak" value={shift?.shift_end ? formatDateTime(shift.shift_end) : "u tijeku"} />
                    <InfoRow label="Računa" value={String(totals.invoice_count ?? invoiceCount)} />
                    <InfoRow label="Brojevi" value={invoiceRange} />
                    <Divider sx={{ my: 1 }} />
                    <InfoRow label="PDV osnovica" value={eur(totals.shift_vat_base)} />
                    <InfoRow label="PDV" value={eur(totals.shift_vat)} />
                    <InfoRow label="Lučka pristojba" value={eur(totals.shift_harbor_tax)} />
                    <InfoRow label="Ukupno" value={eur(totals.shift_amount ?? total)} bold />
                </Paper>

                {/* Storno stoji IZNAD sredstava plaćanja, kao na mobilnoj: storna su
                    već uračunata u iznose ispod (negativan iznos ih umanjuje), pa
                    blagajnik prvo vidi koliko je izašlo iz blagajne. */}
                {storno.length > 0 ? (
                    <Paper variant="accent" sx={{ p: 2 }}>
                        <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}
                            color="text.secondary"
                        >
                            Storno
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        {storno.map((row) => (
                            <SummaryRow
                                key={`storno-${row.payment_type_uuid}`}
                                name={row.payment_type_name}
                                count={row.invoice_quantity}
                                countLabel="storno"
                                amount={row.amount}
                            />
                        ))}
                        <Divider sx={{ my: 1 }} />
                        <SummaryRow name="Ukupno stornirano" amount={stornoAmount} bold />
                    </Paper>
                ) : null}

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Stack direction="row" alignItems="center" sx={{ pb: 0.5 }}>
                        <Typography
                            variant="subtitle2"
                            sx={{ flex: 1, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}
                            color="text.secondary"
                        >
                            Sredstvo plaćanja
                        </Typography>
                        <Typography
                            variant="subtitle2"
                            sx={{ width: 130, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}
                            color="text.secondary"
                            align="right"
                        >
                            Računa
                        </Typography>
                        <Typography
                            variant="subtitle2"
                            sx={{ width: 150, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}
                            color="text.secondary"
                            align="right"
                        >
                            Iznos
                        </Typography>
                    </Stack>
                    <Divider />
                    {details.length === 0 ? (
                        <Typography color="text.secondary" sx={{ py: 2 }}>
                            Nema računa u ovoj smjeni.
                        </Typography>
                    ) : (
                        details.map((pay) => (
                            <SummaryRow
                                key={pay.payment_type_uuid}
                                name={pay.payment_type_name}
                                count={pay.invoice_quantity}
                                amount={pay.amount}
                            />
                        ))
                    )}
                    {details.length > 0 ? (
                        <>
                            <Divider sx={{ my: 1 }} />
                            <SummaryRow name="Ukupno" count={invoiceCount} amount={total} bold />
                        </>
                    ) : null}
                </Paper>
            </Box>
        </Modal>
    );
}
