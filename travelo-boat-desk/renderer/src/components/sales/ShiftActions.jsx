import { Box, Fab } from "@mui/material";
import { useDispatch } from "react-redux";
import { Save } from '@mui/icons-material';
import SummarizeIcon from '@mui/icons-material/Summarize';
import { setStateData } from "../../store/appSlice";

export default function ShiftActions({params, rowId, setRowId}) {
    const dispatch = useDispatch()

    const handleSummary = async()=>{
        await dispatch(setStateData({path:'status', value:'loading'}))
        await dispatch(setStateData({path:'loadingText', value:'Dohvaćanje podataka o smjeni...'}))
        const data = params.row
        const shiftsData = await window.api.app.summaryShiftsDataIpc(data);
        console.log('SHIFTS ', shiftsData.data)
        await dispatch(setStateData({path:'workingData/shiftDetails', value: shiftsData?.data.shift_details}))
        dispatch(setStateData({path:'modalsStates/showShiftSummaryModal', value: true}))
        await dispatch(setStateData({path:'status', value:'ready'}))
    }

    const handleEndShift = async() => {
        await dispatch(setStateData({path:'status', value:'loading'}))
        await dispatch(setStateData({path:'loadingText', value:'Zaključivanje smjene...'}))
        console.log(params.row)
        const data = params.row
        const closeShift = await window.api.app.closeShiftsDataIpc(data);
        const getshiftsData = await window.api.app.getShiftsDataIpc();
        dispatch(setStateData({ path: "shiftsData/shifts", value: getshiftsData.data.shifts || [] }));
        await dispatch(setStateData({path:'status', value:'ready'}))
    };

    return(
            <Box
            sx={{
                m: 1,
                position: 'relative',
            }}
            >
            <Fab
                color="primary"
                sx={{
                    mr:1,
                    width: 40,
                    height: 40,
                }}
                onClick={handleSummary}
                >
                <SummarizeIcon />
            </Fab>
            <Fab
                color="primary"
                sx={{
                    width: 40,
                    height: 40,
                }}
                disabled={!params.row.shift_open}
                onClick={handleEndShift}
                >
                <Save />
            </Fab>
        
        </Box>
    )
}