import { useSelector } from "react-redux";
import { authSliceData } from "../auth/authSlice";
import InvoicesPage from "./pages/invoices/InvoicesPage";
import BusInvoicesPage from "../bus/pages/invoices/BusInvoicesPage";

// Financije → Računi, mode-ovisno. `env_modules` zrcali TRAVELO_MODULES
// (control-service /modules_config). Kad je upaljen samo BUS mod, prikazujemo
// bus račune (bus-service store); inače boat/web račune (transactions-service).
export default function FinanceInvoicesPage() {
    const authData = useSelector(authSliceData);
    const env = (authData?.modulesCatalog?.env_modules || []).map((m) => String(m).toUpperCase());
    const busMode = env.includes("BUS") && !env.includes("BOAT");
    return busMode ? <BusInvoicesPage /> : <InvoicesPage />;
}
