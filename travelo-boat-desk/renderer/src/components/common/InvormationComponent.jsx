import { Alert, IconButton, Snackbar } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, resetStateData } from "../../store/appSlice";
import { useEffect } from "react";
import { useState } from "react";


export default function InformationComponent() {
    const dispatch = useDispatch()
    const appData = useSelector(allAppData);
    const [open, setOpen] = useState(false)
    
    const handleClose = async()=>{
        await dispatch(resetStateData({path:'alertData'}))
        setOpen(false)
    }
    useEffect(()=>{
        console.log('PROMJENA MESSAGEA', appData.alertData)
        if(appData.alertData?.message){
            setOpen(true)
             setTimeout(handleClose, 3000);
        }else{
            setOpen(false)
        }
    },[appData.alertData])


    const state= {
        vertical: 'top',
        horizontal: 'center',
      }
      const { vertical, horizontal} = state;
    useEffect(()=>{
        setTimeout(handleClose, 3000);
    },[])

    return (
        <>
            <Snackbar
                anchorOrigin={{ vertical, horizontal }}
                open={open}
            >
                <Alert
                    severity={appData.alertData.severity}
                    action={
                        <IconButton
                            aria-label="close"
                            color="inherit"
                            size="small"
                        >
                        </IconButton>
                    }
                    sx={{ mb: 2 }}
                >
                    {appData.alertData.message}
                </Alert>
                </Snackbar>
        </>
    );
}