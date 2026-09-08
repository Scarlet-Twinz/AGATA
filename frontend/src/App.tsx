import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/contractors" element={<PlaceholderPage title="Contractors" />} />
        <Route path="/projects" element={<PlaceholderPage title="Projects" />} />
        <Route path="/documents" element={<PlaceholderPage title="Documents" />} />
        <Route path="/alerts" element={<PlaceholderPage title="Alerts" />} />
        <Route path="/rumi" element={<PlaceholderPage title="Rumi" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
      </Route>
    </Routes>
  );
}
