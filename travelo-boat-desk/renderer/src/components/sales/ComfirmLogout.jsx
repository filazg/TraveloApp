import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Button, Grid, Modal, Typography } from "@mui/material";
import { allAppData, resetStateData, setStateData } from "../../store/appSlice";

export default function ComfirmLogout() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);


  const handleLogout = async () => {
    //dispatch(setMessageData({ value: { severity: "info", message: "Doviđenja"}}));
    await dispatch(resetStateData({path:'logedUser'}));
    await dispatch(resetStateData({path:'searchData'}));
    await dispatch(resetStateData({path:'saleData'}));
    await dispatch(setStateData({path:'modalsStates/shohConfirmLogout', value: false}))
  };

  const handleCloseComfirmLogout = () =>{
    dispatch(setStateData({path:'modalsStates/shohConfirmLogout', value: false}))
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

  return (
    <Modal
      open={appData.modalsStates.shohConfirmLogout}
      onClose={handleCloseComfirmLogout}
      aria-labelledby="parent-modal-title"
      aria-describedby="parent-modal-description"
    >
      <Box
        sx={{
          ...style,
          width: 600,
        }}
      >
        <Typography
          id="modal-modal-title"
          variant="h6"
          component="h2"
          align="center"
          sx={{ mb: 2 }}
        >
          Potvrdite odjavu
        </Typography>
        <Grid container direction="column" spacing={1}>
          <Grid item>
            <Button
              color="error"
              onClick={handleLogout}
              sx={{ height: 60, mt: 2, width: "100%" }}
              variant="contained"
            >
              ODJAVA
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Modal>
  );
}
