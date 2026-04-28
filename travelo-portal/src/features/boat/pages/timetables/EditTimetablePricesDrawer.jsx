import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Drawer, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { boatSliceData, getBoatThunk, patchBoatThunk, postBoatThunk, setBoatData } from "../../boatSlice";
import { DataGrid } from "@mui/x-data-grid";
import { use, useEffect, useMemo, useState } from "react";
import { useT } from "../../../../i18n/useT";

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

    const pairs = boatData?.editData?.pairsForTimetable ?? [];

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
        const filtered = boatData.editData?.timetablePrices?.filter(
            item => item.ticket_type?.uuid !== newData.ticket_type?.uuid
        );
        updatedData = [...filtered, newData]
        updatedData.sort((a, b) => a.ticket_type?.id - b.ticket_type?.id);
        await dispatch(setBoatData({path:"editData/timetablePrices", value: updatedData}))
        await setNewData({
            ticket_type:{},
            prices: pairs.map(calcRow)
        })
        await setOpenAdd(false)
    }

    const handleDeletePrice = async (data) => {
        console.log(data)
        const filteredPrices = boatData.editData?.timetablePrices?.filter((price)=> price.ticket_type.uuid !== data.ticket_type.uuid)
        await dispatch(setBoatData({path:"editData/timetablePrices", value: filteredPrices}))
    }

    return(
    <>
        <Button sx={{width:300}} onClick={()=>setOpenAdd(true)} variant="contained" >
            Dodaj cijene
        </Button>
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
        {boatData.editData?.timetablePrices?.map((price) => (
            <Box sx={{ mt: 2, width: "100%", overflowX: "auto" }}>
                <Stack
                    direction='row'
                    justifyContent='space-between'
                >
                    <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                        {price.ticket_type?.name} 
                    </Typography>
                    <Button
                        variant='outlined'
                        color="error"
                        onClick={()=>handleDeletePrice(price)}
                    >
                        Ukloni cijene
                    </Button>
                </Stack>
                <Box sx={{ height:"32vh", minWidth: 900 }}>
                    <DataGrid
                        rows={price.prices}
                        columns={columns}
                    />
                </Box>
            </Box>
        ))}
    </>
    )
}