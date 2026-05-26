import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch, Redirect } from "wouter";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import SchedulesPage from "@/pages/schedules";
import IncidentsPage from "@/pages/incidents";
import ProfilePage from "@/pages/profile";
import MyInspectionsPage from "@/pages/my-inspections";
import HistoryPage from "@/pages/history";
import FollowupReportPage from "@/pages/reports/followup-report";
import MonthlyReportPage from "@/pages/reports/monthly-report";
import ActionMatrixPage from "@/pages/reports/action-matrix";
import SmtpSettingsPage from "@/pages/settings/smtp";
import GdriveSettingsPage from "@/pages/settings/gdrive";
import BackupPage from "@/pages/settings/backup";
import UsersPage from "@/pages/master/users";
import CategoriesPage from "@/pages/master/categories";
import GroupsPage from "@/pages/master/groups";
import TemplatesPage from "@/pages/master/templates";
import PlantsPage from "@/pages/master/plants";
import ActionsPage from "@/pages/master/actions";
import IndicatorsPage from "@/pages/master/indicators";
import PreventiveActionsPage from "@/pages/master/preventive-actions";
import IncidentTypesPage from "@/pages/master/incident-types";
import IndicatorReportPage from "@/pages/reports/indicator-report";
import ScheduleCompliancePage from "@/pages/reports/schedule-compliance";
import LogsPage from "@/pages/admin/logs";
import RegisterPage from "@/pages/register";
import PaymentPage from "@/pages/payment";
import LandingPage from "@/pages/landing";
import SysadminApp from "@/pages/sysadmin/index";
import TestimonialPage from "@/pages/testimonial";
import WorkPermitsPage from "@/pages/work-permits/index";
import WorkPermitReportPage from "@/pages/work-permits/report";
import WorkPermitScanPage from "@/pages/work-permits/scan";
import MyApprovalsPage from "@/pages/work-permits/my-approvals";
import WorkPermitTypesPage from "@/pages/master/work-permit-types";
import MapsPage from "@/pages/master/maps";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// For company portal (/c/{slug}/...), include slug in router base so wouter routes match correctly
const _slugMatch = window.location.pathname.match(/^\/c\/([^/]+)/);
const _viteBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const base = _slugMatch ? `/c/${_slugMatch[1]}` : _viteBase;

function isPaymentRoute() {
  return /^\/c\/[^/]+\/payment/.test(window.location.pathname);
}
function isWorkPermitScanRoute() {
  return /^\/c\/[^/]+\/scan/.test(window.location.pathname);
}
function isSysadminRoute() {
  return window.location.pathname.startsWith("/sysadmin");
}
function isRegisterRoute() {
  return window.location.pathname.startsWith("/register");
}
function isCompanyPortalRoute() {
  return /^\/c\/[^/]+/.test(window.location.pathname);
}

function MainApp() {
  const { user, paywallInfo } = useAuth();

  // Paywall: subscription expired / suspended / pending
  if (!user && paywallInfo) return <PaymentPage />;

  // Not logged in:
  // - Company portal route → show company login page
  // - Root or other → show landing page
  if (!user) {
    if (isCompanyPortalRoute()) return <LoginPage />;
    return <LandingPage />;
  }

  if (user.role === "sysadmin") return <SysadminApp />;

  return (
    <Router base={base}>
      <Layout>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/my-inspections" component={MyInspectionsPage} />
          <Route path="/history" component={HistoryPage} />
          <Route path="/schedules" component={SchedulesPage} />
          <Route path="/incidents" component={IncidentsPage} />
          <Route path="/reports/followup" component={FollowupReportPage} />
          <Route path="/reports/monthly" component={MonthlyReportPage} />
          <Route path="/reports/action-matrix" component={ActionMatrixPage} />
          <Route path="/settings/smtp" component={SmtpSettingsPage} />
          <Route path="/settings/gdrive" component={GdriveSettingsPage} />
          <Route path="/settings/backup" component={BackupPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/master/users" component={UsersPage} />
          <Route path="/master/categories" component={CategoriesPage} />
          <Route path="/master/groups" component={GroupsPage} />
          <Route path="/master/templates" component={TemplatesPage} />
          <Route path="/master/plants" component={PlantsPage} />
          <Route path="/master/actions" component={ActionsPage} />
          <Route path="/master/indicators" component={IndicatorsPage} />
          <Route path="/master/preventive-actions" component={PreventiveActionsPage} />
          <Route path="/master/incident-types" component={IncidentTypesPage} />
          <Route path="/master/work-permit-types" component={WorkPermitTypesPage} />
          <Route path="/master/maps" component={MapsPage} />
          <Route path="/reports/indicators" component={IndicatorReportPage} />
          <Route path="/reports/schedule-compliance" component={ScheduleCompliancePage} />
          <Route path="/admin/logs" component={LogsPage} />
          <Route path="/payment" component={PaymentPage} />
          <Route path="/testimonial" component={TestimonialPage} />
          <Route path="/work-permits/my-approvals" component={MyApprovalsPage} />
          <Route path="/work-permits/report" component={WorkPermitReportPage} />
          <Route path="/work-permits" component={WorkPermitsPage} />
          <Route><Redirect to="/" /></Route>
        </Switch>
      </Layout>
    </Router>
  );
}

export default function App() {
  // Sysadmin and register don't need AuthProvider
  if (isSysadminRoute()) {
    return (
      <QueryClientProvider client={queryClient}>
        <SysadminApp />
        <Toaster />
      </QueryClientProvider>
    );
  }

  if (isRegisterRoute()) {
    return (
      <QueryClientProvider client={queryClient}>
        <RegisterPage />
        <Toaster />
      </QueryClientProvider>
    );
  }

  if (isWorkPermitScanRoute()) {
    return (
      <QueryClientProvider client={queryClient}>
        <WorkPermitScanPage />
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {isPaymentRoute() ? <PaymentPage /> : <MainApp />}
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
