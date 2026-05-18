import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage } from "../lib/api";

export default function RegisterPage() {
  const { isAuthenticated, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    confirmarSenha: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/app/home" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.senha !== form.confirmarSenha) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await register({
        nome: form.nome,
        email: form.email,
        senha: form.senha
      });
      navigate("/app/home", { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sv-auth-screen">
      <div className="card shadow sv-auth-card">
        <h1 className="fw-bold text-center">SolarVision</h1>
        <p className="text-center text-muted">Registre-se</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Nome"
              value={form.nome}
              onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
              required
            />
          </div>
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
          <div className="mb-3">
            <input
              type="password"
              className="form-control"
              placeholder="Confirmar senha"
              value={form.confirmarSenha}
              onChange={(event) =>
                setForm((current) => ({ ...current, confirmarSenha: event.target.value }))
              }
              required
            />
          </div>

          {error ? <div className="alert alert-danger">{error}</div> : null}

          <button type="submit" className="btn btn-primary w-100" disabled={loading}>
            {loading ? "Criando conta..." : "Registrar-se"}
          </button>
        </form>

        <p className="text-center mt-3 mb-0">
          Já possui uma conta? <Link to="/login" className="text-decoration-none">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
