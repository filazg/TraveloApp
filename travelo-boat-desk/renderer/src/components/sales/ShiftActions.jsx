import { Box, Fab } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { Save } from '@mui/icons-material';
import SummarizeIcon from '@mui/icons-material/Summarize';
import { allAppData, setStateData } from "../../store/appSlice";

export default function ShiftActions({params, rowId, setRowId}) {
    const dispatch = useDispatch()
    const appData = useSelector(allAppData);

    const handleSummary = async()=>{
        await dispatch(setStateData({path:'status', value:'loading'}))
        await dispatch(setStateData({path:'loadingText', value:'Dohvaćanje podataka o smjeni...'}))
        const data = params.row
        const shiftsData = await window.api.app.summaryShiftsDataIpc(data);
        console.log('SHIFTS ', shiftsData.data)
        await dispatch(setStateData({updates:[
            {path:'workingData/shiftDetails', value: shiftsData?.data?.shift_details || []},
            {path:'workingData/shiftStorno', value: shiftsData?.data?.storno || []},
            {path:'workingData/shiftStornoAmount', value: shiftsData?.data?.storno_amount || 0},
            {path:'workingData/shiftSummaryFor', value: params.row},
        ]}))
        dispatch(setStateData({path:'modalsStates/showShiftSummaryModal', value: true}))
        await dispatch(setStateData({path:'status', value:'ready'}))
    }

    const handleEndShift = async() => {
        await dispatch(setStateData({path:'status', value:'loading'}))
        await dispatch(setStateData({path:'loadingText', value:'Zaključivanje smjene...'}))
        console.log(params.row)
        const data = params.row
        const closeShift = await window.api.app.closeShiftsDataIpc(data);
        // Bez korisničkog imena servis vraća smjene SVIH operatera, pa je
        // blagajnik nakon zatvaranja u listi vidio i tuđe smjene.
        const getshiftsData = await window.api.app.getShiftsDataIpc(appData.logedUser?.user_username);
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