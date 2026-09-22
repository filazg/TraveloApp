import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  IconButton,
  Tooltip,
  MenuItem,
  Menu,
  ListSubheader,
  ListItemText,
  ListItemIcon,
  Divider,
} from "@mui/material";
import { iconsMap } from "../helpers/iconsMap";
import LogoutIcon from "@mui/icons-material/Logout";
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
import LanguageIcon from '@mui/icons-material/Menu';
import LockResetIcon from '@mui/icons-material/LockReset';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import BrandMark from "./BrandMark";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { authSliceData, resetAuthData, setAuthData } from "../features/auth/authSlice";
import ChangePasswordDialog from "../features/auth/ChangePasswordDialog";
import { useState } from "react";

// Modules from the catalog use `groups` + `{hr,en}` labels; legacy hardcoded
// modules use `submenu` + plain strings. Normalize so the menu renders both.
const pickLabel = (val, lang) => {
  if (val == null) return "";
  if (typeof val === "string") return val;
  return val[lang] || val.hr || val.en || Object.values(val)[0] || "";
};

const getMenuSections = (feature, lang) => {
  const sections = feature?.submenu || feature?.groups || [];
  return sections.map((s) => ({
    label: pickLabel(s.label, lang),
    icon: s.icon,
    items: (s.items || []).map((i) => ({
      label: pickLabel(i.label, lang),
      subtitle: pickLabel(i.subtitle, lang),
      icon: i.icon,
      path: i.path,
    })),
  }));
};

export default function Topbar() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const authData = useSelector(authSliceData);
  const [openMenu, setOpenMenu] = useState(false);
  const [anchorElMenu, setAnchorElMenu] = useState(null);
  const [openLangMenu, setOpenLangMenu] = useState(false);
  const [anchorElLang, setAnchorElLang] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [openPwdDialog, setOpenPwdDialog] = useState(false);

  const lang = authData?.selectedLanguage?.code || "hr";
  const feature = authData.selectedFeature;
  const menuSections = getMenuSections(feature, lang);
  const accent = feature?.color || "#175BD0";
  const featureTitle = pickLabel(feature?.title, lang);

  const handleLogout = () => {
    dispatch(resetAuthData({path:'loggedUserData'}));
  };

  const handleOpen = (e)=>{
    setAnchorElMenu(e.currentTarget)
    setOpenMenu(true)
  }
  const handleClose = ()=>{
    setOpenMenu(false)
  }
  const handleOpenLang = ()=>{
    setOpenLangMenu(true)
  }
  const handleCloseLang = ()=>{
    setOpenLangMenu(false)
  }

  return (
    <AppBar position="static" elevation={1}>
      <Box
        sx={{display:{xs:'flex', md:'none'}, alignItems: "center", justifyContent: "center"}}
      >
      <Typography variant="h5" textAlign='center'
        onClick={() =>{
          navigate("/")}
        }
        sx={{fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap"}}>
        <BrandMark onPrimary /> - Admin portal
      </Typography>

      </Box>
      {/* Tri stupca umjesto space-between: naslov je srednji, a bočni stupci su
          jednake širine (1fr) pa naslov stoji točno na sredini trake bez obzira
          na to koliko je širok gumb izbornika ili koliko je kontrola desno. */}
      {/* Desktop: grid 1fr auto 1fr — naslov centriran. Mobitel: flex
          space-between — meni lijevo dobije svu slobodnu širinu, kontrole se
          skupe uz desni rub (grid bi im rezervirao pola trake). */}
      <Toolbar sx={{ display: { xs: "flex", md: "grid" }, gridTemplateColumns: { md: "1fr auto 1fr" }, justifyContent: "space-between", alignItems: "center", gap: 1 }}>
        {/* LEFT — znak pa izbornik. Na mobitelu flex:1 da meni uzme svu slobodnu
            širinu (kontrole desno uzimaju samo koliko trebaju). */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifySelf: "start", minWidth: 0, flex: { xs: 1, md: "unset" } }}>
          <BrandMark
            variant="h6"
            onPrimary
            sx={{ display: { xs: "none", md: "block" }, cursor: "pointer", mr: 1 }}
            onClick={() => navigate("/")}
          />
          {menuSections.length > 0 ?
            <Button
              variant="outlined"
              onClick={handleOpen}
              startIcon={(() => { const FI = iconsMap[feature?.icon]; return FI ? <FI /> : <MenuIcon />; })()}
              endIcon={<MenuIcon />}
              sx={{ textTransform: "none", borderRadius: 2, color:'white', borderColor:'rgba(255,255,255,0.5)', fontWeight:700, px:1.5, flexShrink: 0, whiteSpace: "nowrap", "&:hover": { borderColor:'white' } }}
            >
              {featureTitle || "Izbornik"}
            </Button>
          :''
          }
          <Menu
            anchorEl={anchorElMenu}
            open={openMenu}
            onClose={handleClose}
            PaperProps={{
              sx: {
                mt: 1,
                borderRadius: 3,
                // Na mobitelu fiksnih 320px zna prijeći širinu ekrana; ograniči na
                // vidljivi dio i dopusti da bude uži na malim uređajima.
                width: { xs: "92vw", sm: 360 },
                maxWidth: "100vw",
                maxHeight: "78vh",
                overflow: "hidden",
                boxShadow: "0 16px 40px rgba(15,23,42,0.18)",
              },
            }}
            MenuListProps={{ sx: { py: 0 } }}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
          >
            {/* Zaglavlje: naziv modula u boji modula */}
            <Box sx={{ px: 2, py: 1.25, display: "flex", alignItems: "center", gap: 1.25, background: accent, color: "white" }}>
              {(() => { const FI = iconsMap[feature?.icon]; return FI ? <FI sx={{ fontSize: 22 }} /> : null; })()}
              <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{featureTitle}</Typography>
            </Box>

            {menuSections.map((section, si)=>(
              <Box key={section.label} sx={{ py: 0.5 }}>
                <ListSubheader
                  disableSticky
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    lineHeight: 2.2,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: "text.secondary",
                  }}
                >
                  <Box sx={{ width: 4, height: 14, borderRadius: 1, background: accent }} />
                  {section.label}
                </ListSubheader>

                {section.items.map((item) => {
                  const active =
                    location.pathname === item.path ||
                    location.pathname.startsWith(item.path + "/");
                  const ItemIcon = iconsMap[item.icon];
                  return (
                    <MenuItem
                      key={item.path}
                      selected={active}
                      onClick={() => {
                        handleClose()
                        navigate(item.path)
                        dispatch(setAuthData({path:'loadingMessage', value:'Povezivanje na poslužitelj'}))
                        dispatch(setAuthData({path:'loading', value:true}))
                      }}
                      sx={{
                        borderRadius: 1.5, mx: 1, my: 0.25, py: 0.6,
                        "&.Mui-selected": { background: `${accent}14` },
                        "&.Mui-selected:hover": { background: `${accent}22` },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 34, color: active ? accent : "text.secondary" }}>
                        {ItemIcon ? <ItemIcon sx={{ fontSize: 20 }} /> : null}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 700 : 500 }}
                      />
                    </MenuItem>
                  );
                })}

                {si < menuSections.length - 1 && <Divider sx={{ my: 0.5 }} />}
              </Box>
            ))}
          </Menu>
        </Box>

        {/* CENTER — samo naslov; znak stoji lijevo */}
        <Typography
          variant="h6"
          sx={{
            display: { xs: "none", md: "block" },
            justifySelf: "center",
            fontWeight: 800, whiteSpace: "nowrap" }}
        >
          Admin portal
        </Typography>

        {/* RIGHT — uz desni rub; ne skuplja se (flexShrink:0) da ikone ostanu
            čitljive, a lijevi meni dobije ostatak. */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifySelf: "end", flexShrink: 0 }}>
          {authData.loggedUserData?.username && (
            <>
              {/* Klik na korisnicko ime otvara izbornik s promjenom lozinke. */}
              <Button
                color="inherit"
                onClick={(e) => setAnchorElUser(e.currentTarget)}
                startIcon={<AccountCircleIcon />}
                sx={{ textTransform: "none", opacity: 0.9, fontWeight: 600, minWidth: { xs: 0, sm: 64 }, "& .MuiButton-startIcon": { mr: { xs: 0, sm: 1 } } }}
              >
                {/* Ime se skriva na uskim ekranima da desne kontrole ne prelaze rub. */}
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  {authData.loggedUserData?.username}
                </Box>
              </Button>
              <Menu
                anchorEl={anchorElUser}
                open={Boolean(anchorElUser)}
                onClose={() => setAnchorElUser(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                PaperProps={{ sx: { mt: 1, borderRadius: 2, minWidth: 220 } }}
              >
                <MenuItem
                  onClick={() => { setAnchorElUser(null); setOpenPwdDialog(true); }}
                >
                  <ListItemIcon><LockResetIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Promijeni lozinku" />
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { setAnchorElUser(null); handleLogout(); }}>
                  <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Odjava" />
                </MenuItem>
              </Menu>
            </>
          )}

          <Tooltip >
            <IconButton
              color="inherit"
              onClick={handleOpenLang}
              aria-controls={open ? "lang-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={open ? "true" : undefined}
              size="large"
            >
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                {authData.selectedLanguage.short
                  || (authData.selectedLanguage.code || "").toUpperCase()
                  || authData.selectedLanguage.label}
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
                 {authData.langs ? (
                    authData.langs.map((l)=>(
                      <MenuItem onClick={()=>{
                        dispatch(setAuthData({path:'selectedLanguage', value:l})) 
                        handleCloseLang()}} 
                        key={l.code}>{l.label}</MenuItem>
                      ))
                ):''
              }
                 
              </Menu>
            <IconButton title="Početna" color="inherit" onClick={() => {
              dispatch(resetAuthData({path:'selectedFeature'}))
              navigate("/home")
              }}>
              <HomeIcon />
            </IconButton>
            <IconButton title="Odjava" color="inherit" onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
      <ChangePasswordDialog open={openPwdDialog} onClose={() => setOpenPwdDialog(false)} />
    </AppBar>
  );
}
