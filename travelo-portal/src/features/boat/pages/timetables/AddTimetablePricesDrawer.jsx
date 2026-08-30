import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Drawer, MenuItem, Paper, Stack, Switch, TextField, Typography } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { boatSliceData, getBoatThunk, patchBoatThunk, postBoatThunk, setBoatData } from "../../boatSlice";
import { DataGrid } from "@mui/x-data-grid";
import { use, useEffect, useMemo, useState } from "react";
import { useT } from "../../../../i18n/useT";
import { collapseHarborPairs } from "./harborPairs";

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

export default function AddTimetablesPricesDrawer(){
    const dispatch = useDispatch()
    const boatData = useSelector(boatSliceData)
    const { t } = useT();
    const [openAdd, setOpenAdd] = useState(false);
    const [newData, setNewData] = useState({})

    const svisParovi = boatData?.newData?.pairsForTimetable ?? [];
    // Zastavica stoji uz cijene jer se samo njih i tice: kad je ukljucena,
    // relacija se unosi jednom i prikazuje jednom, a povratni smjer dobiva istu
    // cijenu pri spremanju.
    const obaSmjera = Boolean(boatData?.newData?.timetableData?.same_price_both_ways);
    // Popis mora zadrzati isti identitet izmedu iscrtavanja — inace se tablica
    // cijena vrti u krug (novi popis -> novi unos -> novo iscrtavanje).
    const pairs = useMemo(
        () => (obaSmjera ? collapseHarborPairs(svisParovi) : svisParovi),
        [svisParovi, obaSmjera],
    );

    const handleObaSmjera = async (checked) => {
        const timetableData = {
            ...(boatData?.newData?.timetableData || {}),
            same_price_both_ways: checked,
        };
        await dispatch(setBoatData({ path: "newData/timetableData", value: timetableData }));
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

    const handleAddPrice = async () => {
        console.log(newData)
        let updatedData = []
        const filtered = boatData.newData?.timetablePrices?.filter(
            item => item.ticket_type?.uuid !== newData.ticket_type?.uuid
        );
        updatedData = [...filtered, newData]
        updatedData.sort((a, b) => a.ticket_type?.id - b.ticket_type?.id);
        await dispatch(setBoatData({path:"newData/timetablePrices", value: updatedData}))
        await setNewData({
            ticket_type:{},
            prices: pairs.map(calcRow)
        })
        await setOpenAdd(false)
    }

    const handleDeletePrice = async (id) => {

    }

    return(
    <>
        <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} spacing={2}>
            <Button sx={{width:300}} onClick={()=>setOpenAdd(true)} variant="contained" >
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
                overflow: "auto", 
                },
            }}
        >   
            <Box sx={{ minWidth:900, height: "100%", display: "flex", flexDirection: "column" }}>
                
                <Box sx={{ px: 3, pt: 2, pb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
                        <Typography variant="h5" fontWeight="bold">
                            {t("boat.timetables.add_new_title")}
                        </Typography>
                        <Button onClick={() => setOpenAdd(false)}>{t("boat.timetables.close")}</Button>
                    </Stack>
                    <Box sx={{ flex: 1, overflow: "auto", px: 3, py: 3 }}>
                        <Box sx={{ minWidth: 900, mb:2 }}>
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
                                    {boatData.boatData?.tickets_types?.map((type) => (
                                        <MenuItem key={type.id} value={type}>
                                        {type.name}
                                        </MenuItem>
                                    ))}
                            </TextField>
                        </Box>
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
                        <Box sx={{height:"70vh", minWidth: 900 }}>
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
                        <Button 
                            disabled={
                                !newData.ticket_type?.uuid 
                                || !newData.prices?.length
                            }
                            variant="contained" sx={{mt:2}} onClick={handleAddPrice} 
                            >
                            Spremi cijene
                        </Button>
                    </Box>
                </Box>                   
            </Box>
        </Drawer>
        {boatData.newData?.timetablePrices?.map((price) => (
            <Box sx={{ mt: 2, width: "100%", overflowX: "auto" }}>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                    {price.ticket_type?.name} 
                </Typography>
                <Box sx={{ height:"23vh", minWidth: 900 }}>
                    <DataGrid
                        rows={obaSmjera ? collapseHarborPairs(price.prices) : price.prices}
                        columns={columns}
                    />
                </Box>
            </Box>
        ))}
    </>
    )
}