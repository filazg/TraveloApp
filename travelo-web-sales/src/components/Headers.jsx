import { useState } from "react";
import { Alert, Box, Collapse, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import picture from '../assets/boat.png'

export const MessagesHeader = ({ title, text, servety }) => {
  const [open, setOpen] = useState(true);
  return (
    <Stack sx={{ width: "100%", mt: 2 }} spacing={2}>
      <Collapse in={open}>
        <Alert
          severity={servety}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setOpen(false)}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          <Typography variant="h5" fontWeight="bold" sx={{ m: "0 0 3px 0" }}>
            {title}
          </Typography>
          <Typography variant="h6">{text}</Typography>
        </Alert>
      </Collapse>
    </Stack>
  );
};


export const Title = ({ title, subtitle }) => {
  return (
    <Box mb="30px" mt="30px">
      <Typography
        variant="h3"
        
        fontWeight="bold"
        sx={{ m: "0 0 5px 0" }}
      >
        {title}
      </Typography>
      <Typography variant="h5" align="center">
        {subtitle}
      </Typography>
    </Box>
  );
};

export const TitleSmall = ({ from, to }) => {
  return (
    <Box mb="5px" >
      <Typography variant="h5" align="center" >
        {from} -- <img height='20' alt="boat" src={picture} /> -- {to}
      </Typography>
    </Box>
  );
};

export const TitleSelectText = ({ text1, text2 }) => {
  return (
    <Box mb="5px" >
      <Typography variant="subtitle1" align="center" >
        {text1}
        </Typography>
    </Box>
  );
};

export const HeaderSmall = ({ title, subtitle, subtitle1 }) => {
  return (
    <Box mb="8px" mt="13px">
      <Typography
        onClick={() => { window.location.href = 'https://bookingtest.krilo.hr/'; } }
        variant="h5"
        fontWeight="bold"
        sx={{ m: "0 0 5px 0", "&:hover": { cursor: 'pointer' }, color:'white' }}
      >
        {title}
      </Typography>
      <Typography variant="h6" >
        {subtitle}
      </Typography>
      <Typography variant="subtitle2">
        {subtitle1}
      </Typography>
    </Box>
  );
};

export const HeaderTicketNum = ({ title, subtitle }) => {
  return (
    <Box mb="8px" mt={2}>
      <Typography
        variant="h5"
        
        fontWeight="bold"
        sx={{ m: "0 0 5px 0" }}
      >
        {title}
      </Typography>
      <Typography variant="h6" >
        {subtitle}
      </Typography>
    </Box>
  );
};
