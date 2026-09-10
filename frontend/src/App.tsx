import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AppShell } from "./components/AppShell";
import { PublicLayout } from "./components/PublicLayout";
import DashboardPage from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { PublicInfoPage } from "./pages/PublicInfoPage";
import { ContactPage } from "./pages/ContactPage";
import { LegalPage } from "./pages/LegalPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import RequirementsPage from "./pages/RequirementsPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

const page = (title: string, description?: string) => <PlaceholderPage title={title} description={description} />;

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/how-it-works" element={<PublicInfoPage />} />
          <Route path="/about" element={<PublicInfoPage />} />
          <Route path="/faq" element={<PublicInfoPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<LegalPage />} />
          <Route path="/terms" element={<LegalPage />} />
          <Route path="/support" element={<Navigate to="/contact" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/projects/:projectId/contractors/:contractorId" element={page("Contractor readiness", "See whether a contractor is ready for this project and why.")} />
            <Route path="/contractors" element={page("Contractors", "Manage contractor profiles and their evidence.")} />
            <Route path="/contractors/:contractorId" element={page("Contractor profile", "View evidence, projects, and readiness.")} />
            <Route path="/requirements" element={<RequirementsPage />} />
            <Route path="/evidence" element={page("Evidence", "Store, map, and review evidence against requirements.")} />
            <Route path="/readiness" element={page("Readiness", "See readiness decisions across your workspace.")} />
            <Route path="/rumi" element={page("Rumi", "Ask questions about your compliance workspace and readiness decisions.")} />
            <Route path="/insights" element={page("Insights", "Understand patterns across projects, contractors, requirements, and evidence.")} />
            <Route path="/billing" element={page("Billing & Plan", "Manage your AGATA plan, billing status, and subscription settings.")} />
            <Route path="/usage" element={page("Usage", "Monitor workspace usage against your current plan.")} />
            <Route path="/team" element={page("Team", "Invite teammates and manage workspace access.")} />
            <Route path="/notifications" element={page("Notifications", "Review operational items that need your attention.")} />
            <Route path="/audit" element={page("Audit Trail", "Track important changes and decisions across the workspace.")} />
            <Route path="/settings" element={page("Settings", "Manage your company, profile, security, and workspace preferences.")} />
            <Route path="/documents" element={<Navigate to="/evidence" replace />} />
            <Route path="/alerts" element={<Navigate to="/notifications" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
