import { useState } from "react";
import { AppBar, Box, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText,Menu,MenuItem,styled, Toolbar, Typography } from "@mui/material";
import {
    Home,
    CurrencyExchange,
    HelpOutline,
    AccountBalanceWallet,
    ContentCopy,
} from "@mui/icons-material";
import MenuIcon from "@mui/icons-material/Menu"
import { useDispatch, useSelector } from "react-redux";
import { setWebSalesData, webSalesDataSlice } from "../pages/webSalesSlice";
import { useT } from "../i18n/useT";
import { HeaderSmall } from "./Headers";

const StyledToolbar = styled(Toolbar)({
  display: "flex",
  justifyContent: "space-between",
});

const Icons = styled(Box)(({ theme }) => ({
  display: "none",
  alignItems: "center",
  gap: "20px",
  [theme.breakpoints.up("sm")]: {
    display: "flex",
  },
}));


const Navbar = ({ title }) => {
    const dispatch = useDispatch()
    const webSalesData = useSelector(webSalesDataSlice)
    const [state, setState] = useState(false);
    const { t } = useT();
    const [openLangMenu, setOpenLangMenu] = useState(false);
    const [anchorElLang, setAnchorElLang] = useState(null);

    const handleOpenLang = ()=>{
        setOpenLangMenu(true)
    }
    
    const handleCloseLang = ()=>{
        setOpenLangMenu(false)
    }

    const handleOpenDrawer = () => {
        setState(true);
    };
    const handleCloseDrawer = () => {
        setState(false);
    };

    return (
    <AppBar position="sticky">
      <StyledToolbar>
        <Icons>
          <MenuIcon  onClick={handleOpenDrawer}  sx={{ color:'white' }}></MenuIcon >

          {state ? (
            <Drawer
              md={8}
              anchor="top"
              open={state}
              onClose={handleCloseDrawer}
            >
              <List>
                <ListItem disablePadding>
                  <ListItemButton href={t('navbar.home_link')} target="_blank">
                    <ListItemIcon>
                      <Home />
                    </ListItemIcon>
                    <ListItemText primary={t('navbar.home_title')} />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton
                    href={t('navbar.refund_link')}
                    target="_blank"
                  >
                    <ListItemIcon>
                      <CurrencyExchange />
                    </ListItemIcon>
                    <ListItemText primary={t('navbar.refund_title')} />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton
                    href={t('navbar.faq_link')}
                    target="_blank"
                  >
                    <ListItemIcon>
                      <HelpOutline />
                    </ListItemIcon>
                    <ListItemText primary={t('navbar.faq_title')}/>
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton
                    href={t('navbar.payment_link')} 
                    target="_blank"
                  >
                    <ListItemIcon>
                      <AccountBalanceWallet />
                    </ListItemIcon>
                    <ListItemText primary={t('navbar.payment_title')} />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton
                    href= {t('navbar.terms_link')}
                    target="_blank"
                  >
                    <ListItemIcon>
                      <ContentCopy />
                    </ListItemIcon>
                    <ListItemText primary=  {t('navbar.terms_title')} />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemText primary='v.1.0.12' />
                </ListItem>
              </List>
            </Drawer>
          ) : (
            ""
          )}
        </Icons>
          <HeaderSmall title={title} />
        <IconButton
              color="inherit"
              onClick={handleOpenLang}
              aria-controls={open ? "lang-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={open ? "true" : undefined}
              size="large"
            >
              <Typography sx={{ ml: 1, fontWeight: 700, fontSize: 13 }}>
                {webSalesData.selectedLanguage.label}
              </Typography>
            </IconButton>
         <Menu
                id="lang-menu"
                anchorEl={anchorElLang}  
                open={openLangMenu}
                onClose={handleCloseLang}
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                 PaperProps={{
                  sx: {
                    mt: 1,  
                    borderRadius: 2,
                    maxHeight: "70vh",
                  },
                }}
              >
                 {webSalesData.langs ? (
                    webSalesData.langs.map((l)=>(
                      <MenuItem onClick={()=>{
                        dispatch(setWebSalesData({path:'selectedLanguage', value:l})) 
                        handleCloseLang()}} 
                        key={l.code}>{l.label}</MenuItem>
                      ))
                ):''
              }
                 
              </Menu>
      </StyledToolbar>
    </AppBar>
  );
}

export default Navbar;