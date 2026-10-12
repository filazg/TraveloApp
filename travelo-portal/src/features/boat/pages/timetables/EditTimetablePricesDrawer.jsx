import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Drawer, MenuItem, Paper, Stack, Switch, TextField, Typography } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { boatSliceData, getBoatThunk, patchBoatThunk, postBoatThunk, setBoatData } from "../../boatSlice";
import { DataGrid } from "@mui/x-data-grid";
import { use, useEffect, useMemo, useState } from "react";
import { useT } from "../../../../i18n/useT";
import { collapseHarborPairs } from "./harborPairs";
import CopyPricesFromCategory, { preuzmiCijene } from "./CopyPricesFromCategory";

const calcRow = (row) => {
        const price = Number(row.price ?? 0);

        const vatBase = (price * 0.94) / 1.25;
        const vatAmount = price * 0.94 - vatBase;
        const portTax = price * 0.06;

        return {
            ...row,
            price: Number(price.toFixed(2)),
            vat_base: Number(vatBase.toFixed(2)),
            vat_amount: Number(vatAmount.toFixed(2)),
            port_tax: Number(portTax.toFixed(2)),
        };
    };

export default function EditTimetablePricesDrawer(){
    const dispatch = useDispatch()
    const boatData = useSelector(boatSliceData)
    const { t } = useT();
    const [openAdd, setOpenAdd] = useState(false);
    const [newData, setNewData] = useState({})
    // Uredivanje vec unesene vrste karte: vrsta je zakljucana, a tablica dolazi
    // popunjena njezinim cijenama. Spremanje zamijeni stare cijene novima.
    const [uredi, setUredi] = useState(false)

    const svisParovi = boatData?.editData?.pairsForTimetable ?? [];
    // Zastavica stoji uz cijene jer se samo njih i tice: kad je ukljucena,
    // relacija se unosi jednom i prikazuje jednom, a povratni smjer dobiva istu
    // cijenu pri spremanju.
    const obaSmjera = Boolean(boatData?.editData?.timetableData?.same_price_both_ways);
    // Popis mora zadrzati isti identitet izmedu iscrtavanja — inace se tablica
    // cijena vrti u krug (novi popis -> novi unos -> novo iscrtavanje).
    const pairs = useMemo(
        () => (obaSmjera ? collapseHarborPairs(svisParovi) : svisParovi),
        [svisParovi, obaSmjera],
    );

    const handleObaSmjera = async (checked) => {
        const timetableData = {
            ...(boatData?.editData?.timetableData || {}),
            same_price_both_ways: checked,
        };
        await dispatch(setBoatData({ path: "editData/timetableData", value: timetableData }));
    };

    useEffect(() => {
        setNewData({...newData,prices: pairs.map(calcRow)})
    }, [pairs]);


    const handleChange = async (e) => {
        setNewData({...newData, [e.target.name] : e.target.value})
        
    };
  
  
    const columns = [
        { field: "harbor_from", headerName: "Harbor From", flex: 2 },
        { field: "harbor_from_code", headerName: "Harbor From Code", flex: 2 },
        { field: "harbor_to", headerName: "Harbor To", flex: 2 },
        { field: "harbor_to_code", headerName: "Harbor To Code", flex: 2 },

        { field: "vat_base", type: "number", headerName: "VAT base", flex: 2 },
        { field: "vat_amount", type: "number", headerName: "VAT amount", flex: 2 },
        { field: "port_tax", type: "number", headerName: "Port tax", flex: 2 },
        {
            field: "price",
            type: "number",
            headerName: "Price",
            flex: 2,
            editable: true,
            valueFormatter: (p) => {
                const value = (p && typeof p === "object" && "value" in p) ? p.value : p;
                return Number(value ?? 0).toFixed(2);
            },
        },
    ];

    // Spremljene cijene se samo prikazuju — mijenjaju se preko "Uredi".
    const columnsPrikaz = columns.map((c) => ({ ...c, editable: false }));

    const otvoriNovu = () => {
        setUredi(false);
        setNewData({ ticket_type: "", prices: pairs.map(calcRow) });
        setOpenAdd(true);
    };

    const otvoriUredi = (kategorija) => {
        const { redovi } = preuzmiCijene(pairs.map(calcRow), kategorija.prices, 0, calcRow);
        setUredi(true);
        setNewData({ ticket_type: kategorija.ticket_type, prices: redovi });
        setOpenAdd(true);
    };

    // zatvori=false: "Spremi i dodaj novu" — cijene se spreme, a prozor ostaje
    // otvoren s praznom formom za sljedecu vrstu karte.
    const handleAddPrice = async (zatvori = true) => {
        console.log(newData)
        let updatedData = []
        const filtered = boatData.editData?.timetablePrices?.filter(
            item => item.ticket_type?.uuid !== newData.ticket_type?.uuid
        );
        updatedData = [...filtered, newData]
        updatedData.sort((a, b) => a.ticket_type?.id - b.ticket_type?.id);
        await dispatch(setBoatData({path:"editData/timetablePrices", value: updatedData}))
        await setNewData({
            ticket_type:"",
            prices: pairs.map(calcRow)
        })
        setUredi(false)
        if (zatvori) await setOpenAdd(false)
    }

    const handleDeletePrice = async (data) => {
        console.log(data)
        const filteredPrices = boatData.editData?.timetablePrices?.filter((price)=> price.ticket_type.uuid !== data.ticket_type.uuid)
        await dispatch(setBoatData({path:"editData/timetablePrices", value: filteredPrices}))
    }

    return(
    <>
        <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} spacing={2}>
            <Button sx={{width:300}} onClick={otvoriNovu} variant="contained" >
                Dodaj cijene
            </Button>
            {/* Zastavica se tice samo cijena, pa stoji uz njih: kad je
                ukljucena, relacija se unosi i prikazuje jednom, a povratni
                smjer dobiva istu cijenu pri spremanju. Ukljucena se i vidi kao
                ukljucena — inace se u tablici od dvadesetak relacija ne bi
                znalo zasto ih je upola manje. */}
            <Paper
                elevation={0}
                onClick={() => handleObaSmjera(!obaSmjera)}
                sx={{
                    px: 2, py: 1.25, borderRadius: 2, cursor: "pointer",
                    border: "1px solid",
                    borderColor: obaSmjera ? "primary.main" : "divider",
                    bgcolor: obaSmjera ? "rgba(23, 91, 208, 0.06)" : "transparent",
                    transition: "background-color .15s, border-color .15s",
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box onClick={(e) => e.stopPropagation()} sx={{ display: "flex" }}>
                        <Switch
                            checked={obaSmjera}
                            onChange={(e) => handleObaSmjera(e.target.checked)}
                            name="same_price_both_ways"
                        />
                    </Box>
                    <Box>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                            Cijena jednaka za oba smjera
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Relacija se unosi jednom — povratni smjer dobiva istu cijenu.
                        </Typography>
                    </Box>
                </Stack>
            </Paper>
        </Stack>
        <Drawer
            anchor="right"
            open={openAdd}
            onClose={() => setOpenAdd(false)}
            PaperProps={{
                sx: {
                height: "100%",
                maxWidth: "100vw",
                overflow: "hidden",
                },
            }}
        >   
            <Box sx={{ minWidth:900, height: "100%", display: "flex", flexDirection: "column" }}>
                
                {/* Prozor se slaze u visinu ekrana: zaglavlje, kontrole i gumbi
                    zauzmu koliko trebaju, a tablica ostatak — bez klizaca sa strane. */}
                <Box sx={{ px: 3, pt: 2, pb: 2, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 2, flexShrink: 0 }}>
                        <Typography variant="h5" fontWeight="bold">
                            {uredi ? `Uređivanje cijena — ${newData.ticket_type?.name || ""}` : t("boat.timetables.add_new_title")}
                        </Typography>
                        <Button onClick={() => setOpenAdd(false)}>{t("boat.timetables.close")}</Button>
                    </Stack>
                    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                        {/* Kod uredivanja je vrsta karte vec zadana (stoji u naslovu). */}
                        {!uredi && (
                        <Box sx={{ mb: 2, flexShrink: 0 }}>
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label="Vrsta karte"
                                placeholder="Vrsta karte"
                                select
                                value={newData.ticket_type || ""}
                                onChange={handleChange}
                                name="ticket_type"
                                sx={{
                                    width: 350,
                                    ml:1
                                }}
                                >
                                    {/* Nude se samo vrste karata koje na ovom plovidbenom
                                        redu jos nemaju cijene. */}
                                    {(boatData.boatData?.tickets_types || [])
                                        .filter((type) => !(boatData.editData?.timetablePrices || []).some((p) => p.ticket_type?.uuid === type.uuid))
                                        .map((type) => (
                                        <MenuItem key={type.id} value={type}>
                                        {type.name}
                                        </MenuItem>
                                    ))}
                            </TextField>
                        </Box>
                        )}
                        <CopyPricesFromCategory
                            key={newData.ticket_type?.uuid || "nova"}
                            kategorije={boatData.editData?.timetablePrices}
                            odabranaUuid={newData.ticket_type?.uuid}
                            onPrimijeni={(izvor, pct) => {
                                const { redovi, nadeno } = preuzmiCijene(newData.prices, izvor, pct, calcRow);
                                setNewData((prev) => ({ ...prev, prices: redovi }));
                                return nadeno;
                            }}
                        />
                        {obaSmjera ? (
                            <Typography
                                variant="body2"
                                sx={{
                                    mb: 1.5, px: 1.5, py: 1, borderRadius: 1.5,
                                    bgcolor: "rgba(23, 91, 208, 0.06)", color: "primary.main",
                                    borderLeft: "3px solid", borderColor: "primary.main",
                                }}
                            >
                                Cijena vrijedi u oba smjera — relacija se unosi jednom, povratni smjer dobiva istu cijenu.
                            </Typography>
                        ) : null}
                        <Box sx={{ flex: 1, minHeight: 220, minWidth: 900 }}>
                            <DataGrid
                                rows={newData.prices || []}
                                columns={columns}
                                processRowUpdate={(newRow) => {
                                    const computed = calcRow(newRow);

                                    setNewData((prev) => ({
                                    ...prev,
                                    prices: (prev.prices || []).map((r) =>
                                        r.id === computed.id ? computed : r
                                    ),
                                    }));

                                    return computed;
                                }}
                                onProcessRowUpdateError={(err) => console.error(err)}
                            />
                        </Box>
                        <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexShrink: 0 }}>
                            <Button
                                disabled={!newData.ticket_type?.uuid || !newData.prices?.length}
                                variant="contained"
                                onClick={() => handleAddPrice(true)}
                            >
                                Spremi cijene
                            </Button>
                            {!uredi && (
                            <Button
                                disabled={!newData.ticket_type?.uuid || !newData.prices?.length}
                                variant="outlined"
                                onClick={() => handleAddPrice(false)}
                            >
                                Spremi i dodaj novu
                            </Button>
                            )}
                        </Stack>
                    </Box>
                </Box>                   
            </Box>
        </Drawer>
        {boatData.editData?.timetablePrices?.map((price) => (
            <Box sx={{ mt: 2, width: "100%", overflowX: "auto" }}>
                <Stack
                    direction='row'
                    justifyContent='space-between'
                >
                    <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                        {price.ticket_type?.name} 
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" onClick={() => otvoriUredi(price)}>
                            Uredi
                        </Button>
                        <Button
                            variant='outlined'
                            color="error"
                            onClick={()=>handleDeletePrice(price)}
                        >
                            Ukloni cijene
                        </Button>
                    </Stack>
                </Stack>
                <Box sx={{ height:"19vh", minWidth: 900 }}>
                    <DataGrid
                        rows={obaSmjera ? collapseHarborPairs(price.prices) : price.prices}
                        columns={columnsPrikaz}
                    />
                </Box>
            </Box>
        ))}
    </>
    )
}