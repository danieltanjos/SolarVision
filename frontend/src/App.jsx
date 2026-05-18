import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import CadastroPage from "./pages/CadastroPage";
import CleaningPage from "./pages/CleaningPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import MonitoringPage from "./pages/MonitoringPage";
import RegisterPage from "./pages/RegisterPage";
import SettingsPage from "./pages/SettingsPage";

function LandingRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? "/app/home" : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="limpeza" element={<CleaningPage />} />
        <Route path="monitoramento" element={<MonitoringPage />} />
        <Route path="cadastro" element={<CadastroPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
