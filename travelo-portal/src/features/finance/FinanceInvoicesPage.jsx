import InvoicesPage from "./pages/invoices/InvoicesPage";

// Financije → Računi. Prije je ovdje bio prekidač na bus račune kad je bio
// upaljen samo BUS mod; bus je zaseban projekt (TraveloApp-bus) pa je ostao
// samo boat/web put preko transactions servisa.
export default function FinanceInvoicesPage() {
    return <InvoicesPage />;
}
