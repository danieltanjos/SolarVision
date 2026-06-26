import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

const CadastroPage = lazy(() => import("./pages/CadastroPage"));
const CleaningPage = lazy(() => import("./pages/CleaningPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const MonitoringPage = lazy(() => import("./pages/MonitoringPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

function RouteFallback() {
  return (
    <div className="sv-route-fallback">
      <div className="spinner-border text-primary" role="status" />
    </div>
  );
}

function LazyPage({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function LandingRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? "/app/home" : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingRedirect />} />
      <Route
        path="/login"
        element={(
          <LazyPage>
            <LoginPage />
          </LazyPage>
        )}
      />
      <Route
        path="/register"
        element={(
          <LazyPage>
            <RegisterPage />
          </LazyPage>
        )}
      />

      <Route
        path="/app"
        element={(
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        )}
      >
        <Route index element={<Navigate to="/app/home" replace />} />
        <Route
          path="home"
          element={(
            <LazyPage>
              <HomePage />
            </LazyPage>
          )}
        />
        <Route
          path="limpeza"
          element={(
            <LazyPage>
              <CleaningPage />
            </LazyPage>
          )}
        />
        <Route
          path="monitoramento"
          element={(
            <LazyPage>
              <MonitoringPage />
            </LazyPage>
          )}
        />
        <Route
          path="cadastro"
          element={(
            <LazyPage>
              <CadastroPage />
            </LazyPage>
          )}
        />
        <Route
          path="configuracoes"
          element={(
            <LazyPage>
              <SettingsPage />
            </LazyPage>
          )}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
