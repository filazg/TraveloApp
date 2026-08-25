import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";
import { Box, Button, Grid, Modal, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { v4 as uuid } from "uuid";


export default function OpenNewShiftModal() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const [newShift, setNewShift] = useState({});

    const handleNewShiftModalClose = () => {
        dispatch(setStateData({ path: 'modalsStates/showNewShiftView', value: false }))
    }

    const getShiftData = async () => {
        // Bez korisničkog imena servis vraća smjene SVIH operatera — ista greška
        // kao što je bila u ShiftActions nakon zatvaranja smjene.
        const getshiftsData = await window.api.app.getShiftsDataIpc(appData.logedUser?.user_username);
        dispatch(setStateData({ path: "shiftsData/shifts", value: getshiftsData.data.shifts || [] }));
    };

    const handleOpenShift = async (e) => {
        e.preventDefault();
        const shiftData = {
            shift_uuid: uuid(),
            operater_name: appData.logedUser.user_name,
            operater_surname: appData.logedUser.user_surname,
            operater_username: appData.logedUser.user_username,
            shift_remark: newShift.remark,
            shift_start: new Date(),
        };
        console.log(shiftData);
        const openShift = await window.api.app.openShiftsDataIpc(shiftData);
        handleNewShiftModalClose();
        // I lista smjena — smjena je otvorena i blagajnik ide prodavati, a ne
        // gledati popis. Prije je iza forme ostajao otvoren prozor sa smjenama.
        dispatch(setStateData({ path: 'modalsStates/showShiftView', value: false }));
        setNewShift({});
        getShiftData();
    };

     const handleChangeNewShift = (e) => {
        setNewShift((newShift) => ({
            ...newShift,
            [e.target.name]: e.target.value,
        }));
    };

    const style = {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 400,
        bgcolor: "background.paper",
        border: "2px solid #000",
        boxShadow: 24,
        p: 4,
    };

    return (
         <Modal
            open={appData.modalsStates.showNewShiftView}
            onClose={handleNewShiftModalClose}
            aria-labelledby="parent-modal-title"
            aria-describedby="parent-modal-description"
        >
            <Box
                sx={{
                    ...style,
                    width: 400
                }}
            >
                <Box mb="30px" mt="30px">
                    <Typography
                        variant="h5"

                        fontWeight="bold"
                        sx={{ m: "0 0 5px 0" }}
                    >
                        Otvaranje nove smjene
                    </Typography>
                </Box>
                <form>
                    <Grid container direction='column' spacing={1}>
                        <Grid item>
                            <TextField
                                disabled
                                type="text"
                                variant="outlined"
                                fullWidth
                                label='Ime Operatera'
                                placeholder='Ime Operatera'
                                value={appData.logedUser.user_name}
                                //onChange={handleChange}
                                name="operater_name"
                            />
                        </Grid>
                        <Grid item>
                            <TextField
                                disabled
                                type="text"
                                variant="outlined"
                                fullWidth
                                label='Prezime operatera'
                                placeholder='Prezime operatera'
                                value={appData.logedUser.user_surname}
                                //onChange={handleChange}
                                name="operater_name"
                            />
                        </Grid>
                        <Grid item>
                            <TextField
                                type="text"
                                variant="outlined"
                                fullWidth
                                label='Napomena'
                                placeholder='napomena'
                                value={newShift.remark || ""}
                                onChange={handleChangeNewShift}
                                name="remark"
                            />
                        </Grid>
                        <Grid item>
                            <Button
                                type="submit"
                                color="success"
                                onClick={handleOpenShift}
                                //disabled={!canSave}
                                sx={{ height: 60, mt: 2, width: "100%" }}
                                variant="contained"
                            >
                                OTVORI SMJENU
                            </Button>
                        </Grid>
                    </Grid>
                </form>
            </Box>
        </Modal>
    )
}