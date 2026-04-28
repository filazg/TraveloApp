import { Box, Typography } from "@mui/material";
import picture from '../../../assets/kriloeclipse.jpg'

export default function SummaryEmptyComponent (){
    return(
        <Box
            display="flex" justifyContent="center" alignItems="center"
        >
            <img
                  alt="profile-user"
                  src={picture}
                  style={{ cursor: "pointer", borderRadius: "5%",width:'100%' }}
                />
        </Box>
    )
}