import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Só ADMIN entra (dentro de uma ProtectedRoute). Espera o perfil carregar para não mostrar a página nem
// mandar embora quem é ADMIN; quem não é volta para o Início. O banco também barra pela RLS (e_admin()).
export default function AdminRoute({ children }) {
  const { user, perfilPronto } = useAuth();

  if (!perfilPronto) {
    return (
      <div className="sv-route-fallback">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (user?.role !== "ADMIN") {
    return <Navigate to="/app/home" replace />;
  }

  return children;
}
