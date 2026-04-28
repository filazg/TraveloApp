import { useDispatch, useSelector } from "react-redux";
import { IconButton, Tooltip } from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

import { themeModeToggled } from "../../store/appSlice";

export default function ThemeToggleButton() {
  const dispatch = useDispatch();
  const mode = useSelector((state) => state.app.themeMode);

  return (
    <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"}>
      <IconButton onClick={() => dispatch(themeModeToggled())}>
        {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}
