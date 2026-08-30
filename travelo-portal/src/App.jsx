import { CssBaseline, Stack } from '@mui/material';
import LoginPage from './features/auth/Login';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './features/auth/Layout';
import RequireAuth from './features/auth/RequireAuth';
import ModuleSelectorPage from './features/modules/ModulesSelector';
import AppLayout from './layout/AppLayout';
import BackofficePage from './features/backoffice/BackofficePage';
import CompanyPage from './features/backoffice/pages/company/CompanyPage';
import BusinessPremisesPage from './features/backoffice/pages/business_premises/BusinessPremisesPage';
import { LoadingOverlay } from './features/loading/LoadingView';
import PaymentMethodsPage from './features/backoffice/pages/payment_methods/PaymentMethodsPage';
import UsersPage from './features/backoffice/pages/users/UsersPage';
import BillingDevicesPage from './features/backoffice/pages/billing_devices/BillingDevicesPage';
import BoatPage from './features/boat/BoatPage';
import LinesPage from './features/boat/pages/lines/LinesPage';
import TimetablesPage from './features/boat/pages/timetables/Timetables';
import BoatsPage from './features/boat/pages/boats/BoatsPage';
import HarborsPage from './features/boat/pages/harbors/HarborsPage';
import TicketsTypesPage from './features/boat/pages/ticketTypes/TicketsTypesPage';
import PartnersPage from './features/backoffice/pages/partners/PartnersPage';
import AddressbookPage from './features/backoffice/pages/addressbook/AddressbookPage';
import HolidaysPage from './features/backoffice/pages/holidays/HolidaysPage';
import WebNoticesPage from './features/boat/pages/notices/WebNoticesPage';
import StornoPercentagesPage from './features/backoffice/pages/storno_percentages/StornoPercentagesPage';
import InvoicesPage from './features/finance/pages/invoices/InvoicesPage';
import FinanceInvoicesPage from './features/finance/FinanceInvoicesPage';
import FinancePage from './features/finance/FinancePage';
import PartnerInvoicesPage from './features/finance/pages/partner_invoices/PartnerInvoicesPage';
import PartnerCommissionPage from './features/finance/pages/partner_commission/PartnerCommissionPage';
import CountriesPage from './features/backoffice/pages/countries/CountriesPage';
import TicketsOverviewPage from './features/finance/pages/tickets/TicketsOverviewPage';
import HarborTaxReportPage from './features/finance/pages/harbor_tax/HarborTaxReportPage';
import ShiftsPage from './features/finance/pages/shifts/ShiftsPage';
import AccountsPage from './features/finance/pages/accounts/AccountsPage';
import PaymentOrdersPage from './features/finance/pages/payment_orders/PaymentOrdersPage';
import WebSalesSettingsPage from './features/backoffice/pages/channel_settings/WebSalesSettingsPage';
import PartnerSalesSettingsPage from './features/backoffice/pages/channel_settings/PartnerSalesSettingsPage';
import ReportsPage from './features/finance/pages/reports/ReportsPage';
import DailyRealizationPage from './features/finance/pages/reports/DailyRealizationPage';
import ManagementPage from './features/management/ManagementPage';
import MonthlySalesReportPage from './features/management/pages/monthly_sales/MonthlySalesReportPage';
import MonthlyPurchasesReportPage from './features/management/pages/monthly_purchases/MonthlyPurchasesReportPage';
import RegionsPage from './features/boat/pages/regions/RegionsPage';
import SalesPage from './features/sales/SalesPage';
import DispatcherPage from './features/dispatcher/DispatcherPage';
import SailingPage from './features/sailing/SailingPage';
import DownloadsPage from './features/downloads/DownloadsPage';


function App() {


  return (
    <>
     <CssBaseline />
     <LoadingOverlay/>
      <Stack>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<LoginPage />} />
            <Route path="login" element={<LoginPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path='home' element={<ModuleSelectorPage/>}></Route>
                <Route path='backoffice' element={<BackofficePage/>}></Route>
                <Route path='backoffice/company' element={<CompanyPage/>}></Route>
                <Route path='backoffice/business_premises' element={<BusinessPremisesPage/>}></Route>
                <Route path='backoffice/billing_devices' element={<BillingDevicesPage/>}></Route>
                <Route path='backoffice/users' element={<UsersPage/>}></Route>
                <Route path='backoffice/payment_methods' element={<PaymentMethodsPage/>}></Route>
                <Route path='backoffice/partners' element={<PartnersPage/>}></Route>
                <Route path='backoffice/addressbook' element={<AddressbookPage/>}></Route>
                <Route path='boat/notices' element={<WebNoticesPage/>}></Route>
                <Route path='backoffice/holidays' element={<HolidaysPage/>}></Route>
                <Route path='backoffice/storno_percentages' element={<StornoPercentagesPage/>}></Route>
                <Route path='backoffice/countries' element={<CountriesPage/>}></Route>
                <Route path='backoffice/web_sales_settings' element={<WebSalesSettingsPage/>}></Route>
                <Route path='backoffice/partner_sales_settings' element={<PartnerSalesSettingsPage/>}></Route>
                <Route path='boat' element={<BoatPage/>}></Route>
                <Route path='boat/harbors' element={<HarborsPage/>}></Route>
                <Route path='boat/lines' element={<LinesPage/>}></Route>
                <Route path='boat/boats' element={<BoatsPage/>}></Route>
                <Route path='boat/tickets_types' element={<TicketsTypesPage/>}></Route>
                <Route path='boat/timetables' element={<TimetablesPage/>}></Route>
                <Route path='boat/regions' element={<RegionsPage/>}></Route>
                <Route path='finance' element={<FinancePage/>}></Route>
                <Route path='finance/invoices' element={<FinanceInvoicesPage/>}></Route>
                <Route path='finance/partner_invoices' element={<PartnerInvoicesPage/>}></Route>
                <Route path='finance/partner_commission' element={<PartnerCommissionPage/>}></Route>
                <Route path='finance/tickets' element={<TicketsOverviewPage/>}></Route>
                <Route path='finance/harbor_tax_report' element={<HarborTaxReportPage/>}></Route>
                <Route path='finance/shifts' element={<ShiftsPage/>}></Route>
                <Route path='finance/accounts' element={<AccountsPage/>}></Route>
                <Route path='finance/payment_orders' element={<PaymentOrdersPage/>}></Route>
                <Route path='finance/reports' element={<ReportsPage/>}></Route>
                <Route path='finance/reports/daily_realization' element={<DailyRealizationPage/>}></Route>
                <Route path='finance/reports/daily_realization_demo' element={<DailyRealizationPage demo/>}></Route>
                <Route path='management' element={<ManagementPage/>}></Route>
                <Route path='management/monthly_sales_report' element={<MonthlySalesReportPage/>}></Route>
                <Route path='management/monthly_purchases_report' element={<MonthlyPurchasesReportPage/>}></Route>
                <Route path='sales' element={<SalesPage/>}></Route>
                <Route path='dispatcher' element={<DispatcherPage/>}></Route>
                <Route path='sailing' element={<SailingPage/>}></Route>
                <Route path='downloads' element={<DownloadsPage/>}></Route>
              </Route>
            </Route>
          </Route>
        </Routes>
      </Stack>
    </>
  );
}

export default App
