import { Box, Modal, Paper, Stack, Typography } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";



export default function ShiftSummaryModal({params}) {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);

    const handleClose = async()=>{
            dispatch(setStateData({path:'modalsStates/showShiftSummaryModal', value: false}))
        }

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

    return(
         <Modal
            open={appData.modalsStates.showShiftSummaryModal}
            onClose={handleClose}
            aria-labelledby="parent-modal-title"
            aria-describedby="parent-modal-description"
            sx={{
                zIndex: (theme) => theme.zIndex.modal + 10
            }}
        >
             <Box
                sx={{
                    ...style,
                    width: '40%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                }}
            >
                 <Box mb="30px" mt="30px">
                    <Typography variant="h5" fontWeight="bold" sx={{ m: "0 0 5px 0" }}>
                        Pregled smjene
                    </Typography>
                </Box>
                <Stack
                    direction='row'
                    justifyContent='center'
                    alignItems='center'
                    sx={{
                        height:'100%'
                    }}
                >

                    <Typography
                        sx={{
                            width:'40%',
                            ml: 2,
                        }}
                        align="left"
                    >
                        SREDSTVO PLAĆANJA
                    </Typography>
                    <Typography
                        sx={{
                            width:'30%',
                            ml: 2,
                        }}
                        align="right"
                    >
                        BROJ RAČUNA
                    </Typography>
                    <Typography
                        sx={{
                            width:'30%',
                            mr: 2,
                        }}
                        align="right"
                    >
                        IZNOS RAČUNA
                    </Typography>

                </Stack>
                {appData.workingData?.shiftDetails?.map((pay)=>(
                        <Paper
                        key={pay.payment_type_uuid}
                        sx={{
                            width: 590,
                            height: 100,
                            mb:2,
                            backgroundColor: "#C7C8CC",
                        }}
                        >
                            <Stack
                                direction='row'
                                justifyContent='center'
                                alignItems='center'
                                sx={{
                                    height:'100%'
                                }}
                            >

                                <Typography
                                    sx={{
                                        width:'40%',
                                        ml: 2,
                                    }}
                                    align="left"
                                >
                                    {pay.payment_type_name}
                                </Typography>
                                <Typography
                                    sx={{
                                        width:'30%',
                                        ml: 2,
                                    }}
                                    align="right"
                                >
                                    {pay.invoice_quantity}
                                </Typography>
                                <Typography
                                    sx={{
                                        width:'30%',
                                        mr: 2,
                                    }}
                                    align="right"
                                >
                                    {pay.amount.toFixed(2)} EUR
                                </Typography>

                            </Stack>
                        
                        </Paper>
                    ))
                }
            </Box>

        </Modal>
    )
}