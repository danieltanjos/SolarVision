import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage } from "../lib/api";
import logo from "../../img/logo.png";

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
      <div className="card sv-auth-card">
        <div className="sv-auth-brand">
          <img src={logo} alt="" />
          <h1>SolarVision</h1>
          <p>Bem-vindo de volta! Entre para ver suas placas.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-floating mb-3">
            <input
              id="auth-e-mail"
              type="email"
              className="form-control"
              placeholder="E-mail"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
            <label htmlFor="auth-e-mail">E-mail</label>
          </div>
          <div className="form-floating mb-3">
            <input
              id="auth-senha"
              type="password"
              className="form-control"
              placeholder="Senha"
              value={form.senha}
              onChange={(event) => setForm((current) => ({ ...current, senha: event.target.value }))}
              required
            />
            <label htmlFor="auth-senha">Senha</label>
          </div>

          {error ? <div className="alert alert-danger">{error}</div> : null}

          <button type="submit" className="btn btn-primary btn-lg w-100" disabled={loading}>
            {loading ? "Entrando..." : "Login"}
          </button>
        </form>

        <p className="sv-auth-foot">
          Não possui uma conta? <Link to="/register">Registre-se</Link>
        </p>
      </div>
    </div>
  );
}
