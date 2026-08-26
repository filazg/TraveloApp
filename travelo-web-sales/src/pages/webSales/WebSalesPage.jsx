import { useState } from "react";
import { useDispatch, useSelector } from "react-redux"
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    Stack,
    TextField,
    ThemeProvider,
    Typography,
} from "@mui/material"
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import { theme } from "../../theme";
import { resetTripData, setGlobalLoading, setWebSalesData, webSalesDataSlice } from "../webSalesSlice";
import Navbar from "../../components/Navbar";
import { useT } from "../../i18n/useT";
import SummaryEmptyComponent from "./components/SummaryEmpty";
import SearchComponent from "./components/Search";
import SelectComponent from "./components/Select";
import SelectTicketsComponent from "./components/SelectTickets";
import SelectTripsComponent from "./components/SelectTrips";
import LoadingPage from "./components/LoadingPage";
import SelectedTicketsSummaryComponent from "./components/SelectedTicketsSummary";
import LoadingOverlay from "../../components/LoadingOverlay";
import { url } from "../../config/config";

export default function WebSalesPage() {
    const { t } = useT();
    const dispatch = useDispatch();
    const webSalesData = useSelector(webSalesDataSlice);
    const statuses = webSalesData.statuses || {};
    const salesData = webSalesData?.salesData || {};
    const selectedTrip = webSalesData?.selectedData?.selectedTrip;
    const canSelectTrips = !!selectedTrip?.id || !!selectedTrip?.uuid;
    const harbors = webSalesData?.transportData?.harbors;

    // Otočna cijena s odabranog polazka — temelj za gating gumba i izračun popusta.
    const islandPriceRow = (selectedTrip?.prices || []).find((p) => p.is_island === true);
    const islandUnitPrice = islandPriceRow ? Number(islandPriceRow.price) : null;

    const [islandCardOpen, setIslandCardOpen] = useState(false);
    const [islandCardNumber, setIslandCardNumber] = useState("");
    const [islandChecking, setIslandChecking] = useState(false);
    const [islandResult, setIslandResult] = useState(null);
    const [islandError, setIslandError] = useState(null);

    const closeIslandDialog = () => {
        setIslandCardOpen(false);
        setIslandCardNumber("");
        setIslandResult(null);
        setIslandError(null);
        setIslandChecking(false);
    };

    const verifyIslandCard = async () => {
        const cardNo = String(islandCardNumber || "").trim();
        if (!cardNo) return;
        setIslandChecking(true);
        setIslandError(null);
        setIslandResult(null);
        dispatch(setGlobalLoading({ active: true, message: 'Provjera prava na povlašteni prijevoz…' }));
        try {
            const trip = selectedTrip || {};
            const resp = await axios.post(`${url}/check_island_card`, {
                card_no: cardNo,
                route: {
                    line_no: trip.line_code,
                    departure_harbor_code: trip.departure_harbor_id,
                    arrival_harbor_code: trip.arrival_harbor_id,
                },
                date: trip.departure || new Date().toISOString(),
            });
            setIslandResult(resp.data?.data || resp.data);
        } catch (err) {
            setIslandError(err?.response?.data?.data?.message || err.message);
        } finally {
            setIslandChecking(false);
            dispatch(setGlobalLoading({ active: false }));
        }
    };

    const confirmIslandPurchase = () => {
        if (!islandResult?.ima_pravo || !islandUnitPrice) return;
        const trip = selectedTrip || {};
        const pct = Number(islandResult.popust_postotak || 0);
        const factor = 1 - pct / 100;
        const unit = +(islandUnitPrice * factor).toFixed(2);
        // Po iskaznici uvijek samo 1 karta — ne pita se za količinu.
        const qty = 1;
        const port = +(unit * 0.06).toFixed(2);
        const net = unit - port;
        const vatBase = +(net / 1.25).toFixed(2);
        const vat = +(net - vatBase).toFixed(2);
        const ticketsCodes = [{ uuid: uuidv4(), code: uuidv4() }];
        const newTicket = {
            id: (salesData.tickets?.length || 0) + 1,
            sales_route_uuid: trip.uuid,
            line_code: trip.line_code,
            line_name: trip.line_name,
            departure: trip.departure,
            actual_departure: trip.actual_departure,
            actual_arrival: trip.actual_arrival,
            departure_harbor_id: trip.departure_harbor_id,
            departure_harbor_name: trip.departure_harbor_name,
            arrival: trip.arrival,
            arrival_harbor_id: trip.arrival_harbor_id,
            arrival_harbor_name: trip.arrival_harbor_name,
            ticket_type_name: "Otočna karta",
            ticket_type_id: null,
            ticket_type_uuid: islandPriceRow?.ticket_type_uuid || null,
            ticket_group_uuid: uuidv4(),
            single_price: unit,
            total_price: unit,
            total_vat_base: vatBase,
            total_vat: vat,
            total_harbor_tax: port,
            // SEOP metadata za kasniju dojavu prodaje + ispis na karti za gate kontrolu
            is_island: true,
            seop_type: islandPriceRow?.seop_type || null,
            seop_card_no: islandCardNumber,
            seop_discount_pct: pct,
            seop_pravo: islandResult?.pravo_na_pp || null,
            seop_otok: islandResult?.otok || null,
            quantity: qty,
            tickets: ticketsCodes,
        };
        dispatch(setWebSalesData({ path: "salesData/tickets", value: [...(salesData.tickets || []), newTicket] }));
        closeIslandDialog();
        dispatch(resetTripData());
    };

    return (
        <ThemeProvider theme={theme}>
            <LoadingOverlay />
            {harbors?.length ? (
                <Grid
                    container
                    direction="row"
                    justifyContent="center"
                    alignItems="flex-start"
                >
                    <Grid size={12}>
                        <Navbar title={t('navbar.web_sales_title')} />
                    </Grid>

                    <Grid
                        container
                        direction="row"
                        justifyContent="center"
                        size={{ xs: 11, md: 11, lg: 8 }}
                    >
                        {webSalesData?.salesData?.tickets?.length ? (
                            <Grid
                                size={{ xs: true, sm: 10, md: 8, lg: 8, xl: 6 }}
                                sx={{ borderRadius: 3, boxShadow: 2, mt: 4, p: 2 }}
                            >
                                <SelectedTicketsSummaryComponent />
                            </Grid>
                        ) : (
                            <Grid
                                size={{ xs: false, sm: 10, md: 8, lg: 8, xl: 6 }}
                                sx={{
                                    mt: 4,
                                    p: 2,
                                    display: { xs: 'none', xl: 'block' },
                                }}
                            >
                                <SummaryEmptyComponent />
                            </Grid>
                        )}

                        <Grid
                            container
                            direction="column"
                            size={{ xs: true, sm: 10, md: 8, lg: 8, xl: 6 }}
                            sx={{ mt: 4 }}
                            rowSpacing={3}
                        >
                            <Grid sx={{ borderRadius: 3, boxShadow: 2, p: 2 }}>
                                {!statuses.selectTicketType ? (
                                    <Grid size={12}>
                                        <SearchComponent />
                                        <SelectComponent />
                                        {canSelectTrips && <SelectTripsComponent />}
                                    </Grid>
                                ) : (
                                    <SelectTicketsComponent />
                                )}
                            </Grid>

                            {statuses.selectTicketType && islandUnitPrice ? (
                                <Grid
                                    sx={{
                                        borderRadius: 3,
                                        boxShadow: 2,
                                        p: 2,
                                        border: '2px dashed',
                                        borderColor: '#2E7D32',
                                        bgcolor: '#E8F5E9',
                                    }}
                                >
                                    <Stack spacing={1.5} alignItems="center">
                                        <Typography variant="subtitle2" sx={{ color: '#1B5E20', fontWeight: 700 }}>
                                            Samo za otočane
                                        </Typography>
                                        <Button
                                            variant="contained"
                                            fullWidth
                                            startIcon={<CardMembershipIcon />}
                                            onClick={() => setIslandCardOpen(true)}
                                            sx={{
                                                height: 48,
                                                bgcolor: '#2E7D32',
                                                '&:hover': { bgcolor: '#1B5E20' },
                                            }}
                                        >
                                            Kupi otočnu kartu
                                        </Button>
                                    </Stack>
                                </Grid>
                            ) : null}
                        </Grid>
                    </Grid>
                </Grid>
            ) : (
                <LoadingPage />
            )}

            <Dialog
                open={islandCardOpen}
                onClose={closeIslandDialog}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle sx={{ color: '#1B5E20', fontWeight: 700 }}>Otočna karta — provjera prava</DialogTitle>
                <DialogContent dividers>
                    {!islandResult && (
                        <>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Upišite serijski broj otočne iskaznice. Sustav provjerava pravo na povlašteni prijevoz i izračunava cijenu.
                            </Typography>
                            <TextField
                                autoFocus
                                fullWidth
                                label="Broj iskaznice"
                                value={islandCardNumber}
                                onChange={(e) => setIslandCardNumber(e.target.value.replace(/[^0-9]/g, ""))}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && islandCardNumber.trim() && !islandChecking) verifyIslandCard();
                                }}
                                disabled={islandChecking}
                                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                            />
                            {islandError && (
                                <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
                                    {islandError}
                                </Typography>
                            )}
                        </>
                    )}

                    {islandResult && !islandResult.ima_pravo && (
                        <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: '#ffebee', border: '1px solid #ef9a9a' }}>
                            <Typography variant="subtitle2" sx={{ color: '#b71c1c', fontWeight: 700 }}>
                                Iskaznica nema pravo na povlašteni prijevoz.
                            </Typography>
                            {islandResult.poruka && (
                                <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic', color: 'text.secondary' }}>
                                    {islandResult.poruka}
                                </Typography>
                            )}
                        </Box>
                    )}

                    {islandResult && islandResult.ima_pravo && (
                        <>
                            <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: '#e8f5e9', border: '1px solid #a5d6a7', mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ color: '#1b5e20', fontWeight: 700 }}>
                                    Pravo potvrđeno — popust {islandResult.popust_postotak}%
                                    {islandResult.mock ? ' (MOCK)' : ''}
                                </Typography>
                                {islandResult.otok && (
                                    <Typography variant="body2">Otok: <strong>{islandResult.otok}</strong></Typography>
                                )}
                                {islandResult.pravo_na_pp && (
                                    <Typography variant="body2">Šifra prava: <strong>{islandResult.pravo_na_pp}</strong></Typography>
                                )}
                            </Box>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Typography>Cijena karte:</Typography>
                                <Typography sx={{ textDecoration: islandResult.popust_postotak > 0 ? 'line-through' : 'none', color: 'text.secondary' }}>
                                    {Number(islandUnitPrice).toFixed(2)} EUR
                                </Typography>
                                {islandResult.popust_postotak > 0 && (
                                    <Typography sx={{ fontWeight: 700, color: '#1b5e20', fontSize: 18 }}>
                                        {(Number(islandUnitPrice) * (1 - islandResult.popust_postotak / 100)).toFixed(2)} EUR
                                    </Typography>
                                )}
                            </Stack>
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeIslandDialog}>Zatvori</Button>
                    {!islandResult && (
                        <Button
                            variant="contained"
                            disabled={!islandCardNumber.trim() || islandChecking}
                            onClick={verifyIslandCard}
                            sx={{ bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' } }}
                        >
                            {islandChecking ? 'Provjera…' : 'Provjeri pravo'}
                        </Button>
                    )}
                    {islandResult && islandResult.ima_pravo && (
                        <Button
                            variant="contained"
                            color="success"
                            onClick={confirmIslandPurchase}
                        >
                            Potvrdi kupovinu
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </ThemeProvider>
    );
}
