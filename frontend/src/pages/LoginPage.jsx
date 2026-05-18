import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage } from "../lib/api";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", senha: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/app/home" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(form);
      navigate(location.state?.from?.pathname || "/app/home", { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sv-auth-screen">
      <div className="card shadow card-auth sv-auth-card">
        <h1 className="h4 text-center fw-bold mb-1">SolarVision</h1>
        <p className="text-center text-muted mb-4">Bem-vindo de volta!</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <input
              type="email"
              className="form-control"
              placeholder="E-mail"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </div>
          <div className="mb-3">
            <input
              type="password"
              className="form-control"
              placeholder="Senha"
              value={form.senha}
              onChange={(event) => setForm((current) => ({ ...current, senha: event.target.value }))}
              required
            />
          </div>

          {error ? <div className="alert alert-danger">{error}</div> : null}

          <button type="submit" className="btn btn-primary w-100 mb-3" disabled={loading}>
            {loading ? "Entrando..." : "Login"}
          </button>
        </form>

        <p className="text-center mt-3 mb-0">
          Não possui uma conta? <Link to="/register" className="text-decoration-none">Registre-se</Link>
        </p>
      </div>
    </div>
  );
}
