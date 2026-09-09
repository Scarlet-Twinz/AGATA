import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { PublicLayout } from "./components/PublicLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { PublicInfoPage } from "./pages/PublicInfoPage";
import { ContactPage } from "./pages/ContactPage";
import { LegalPage } from "./pages/LegalPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

const page = (title: string, description?: string) => (
  <PlaceholderPage title={title} description={description} />
);

export default function App() {
  return (
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
        <Route path="/login" element={page("Sign in", "Sign in to your AGATA workspace.")} />
        <Route path="/signup" element={page("Get started", "Create your AGATA workspace.")} />
      </Route>

      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={page("Projects", "Manage projects and their compliance requirements.")} />
        <Route path="/projects/:projectId" element={page("Project overview", "Project requirements, contractors, evidence, and readiness.")} />
        <Route path="/projects/:projectId/contractors/:contractorId" element={page("Contractor readiness", "See whether a contractor is ready for this project and why.")} />
        <Route path="/contractors" element={page("Contractors", "Manage contractors and their evidence profiles.")} />
        <Route path="/contractors/:contractorId" element={page("Contractor profile", "View contractor evidence, projects, and readiness.")} />
        <Route path="/requirements" element={page("Requirements", "Manage your reusable compliance requirement library.")} />
        <Route path="/evidence" element={page("Evidence", "Manage evidence and connect it to requirements.")} />
        <Route path="/rumi" element={page("Rumi", "Ask questions about your compliance workspace and readiness decisions.")} />
        <Route path="/settings" element={page("Settings", "Manage your company, profile, and security settings.")} />
        <Route path="/documents" element={<Navigate to="/evidence" replace />} />
        <Route path="/alerts" element={page("Alerts", "Review items that need attention.")} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
