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
import SmtpSettingsPage from "@/pages/settings/smtp";
import UsersPage from "@/pages/master/users";
import CategoriesPage from "@/pages/master/categories";
import GroupsPage from "@/pages/master/groups";
import TemplatesPage from "@/pages/master/templates";
import PlantsPage from "@/pages/master/plants";
import ActionsPage from "@/pages/master/actions";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

function AppRoutes() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
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
          <Route path="/settings/smtp" component={SmtpSettingsPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/master/users" component={UsersPage} />
          <Route path="/master/categories" component={CategoriesPage} />
          <Route path="/master/groups" component={GroupsPage} />
          <Route path="/master/templates" component={TemplatesPage} />
          <Route path="/master/plants" component={PlantsPage} />
          <Route path="/master/actions" component={ActionsPage} />
          <Route><Redirect to="/" /></Route>
        </Switch>
      </Layout>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
