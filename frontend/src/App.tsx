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
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { AcceptInvitationPage } from "./pages/AcceptInvitationPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import RequirementsPage from "./pages/RequirementsPage";
import RequirementDetailPage from "./pages/RequirementDetailPage";
import ContractorsPage from "./pages/ContractorsPage";
import ContractorDetailPage from "./pages/ContractorDetailPage";
import EvidencePage from "./pages/EvidencePage";
import ReadinessPage from "./pages/ReadinessPage";
import RumiPage from "./pages/RumiPage";
import InsightsPage from "./pages/InsightsPage";
import NotificationsPage from "./pages/NotificationsPage";
import UsagePage from "./pages/UsagePage";
import TeamPage from "./pages/TeamPage";
import SettingsPage from "./pages/SettingsPage";
import BillingPage from "./pages/BillingPage";
import AuditPage from "./pages/AuditPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

const page = (title: string, description?: string) => <PlaceholderPage title={title} description={description} />;

export default function App() {
  return <AuthProvider><Routes>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<HomePage />} /><Route path="/how-it-works" element={<PublicInfoPage />} /><Route path="/about" element={<PublicInfoPage />} /><Route path="/faq" element={<PublicInfoPage />} /><Route path="/contact" element={<ContactPage />} /><Route path="/privacy" element={<LegalPage />} /><Route path="/terms" element={<LegalPage />} /><Route path="/support" element={<Navigate to="/contact" replace />} /><Route path="/login" element={<LoginPage />} /><Route path="/signup" element={<SignupPage />} /><Route path="/verify-email" element={<VerifyEmailPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /><Route path="/accept-invitation" element={<AcceptInvitationPage />} />
    </Route>
    <Route element={<ProtectedRoute />}><Route element={<AppShell />}>
      <Route path="/dashboard" element={<DashboardPage />} /><Route path="/projects" element={<ProjectsPage />} /><Route path="/projects/:projectId" element={<ProjectDetailPage />} /><Route path="/projects/:projectId/contractors/:contractorId" element={page("Contractor readiness", "See whether a contractor is ready for this project and why.")} /><Route path="/contractors" element={<ContractorsPage />} /><Route path="/contractors/:contractorId" element={<ContractorDetailPage />} /><Route path="/requirements" element={<RequirementsPage />} /><Route path="/requirements/:requirementId" element={<RequirementDetailPage />} /><Route path="/evidence" element={<EvidencePage />} /><Route path="/readiness" element={<ReadinessPage />} /><Route path="/rumi" element={<RumiPage />} /><Route path="/insights" element={<InsightsPage />} /><Route path="/billing" element={<BillingPage />} /><Route path="/usage" element={<UsagePage />} /><Route path="/team" element={<TeamPage />} /><Route path="/notifications" element={<NotificationsPage />} /><Route path="/audit" element={<AuditPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/documents" element={<Navigate to="/evidence" replace />} /><Route path="/alerts" element={<Navigate to="/notifications" replace />} />
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace" />} />
  </Routes></AuthProvider>;
}
