import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage } from "../lib/api";
import logo from "../../img/logo.png";

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

    if (form.senha.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

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
      <div className="card sv-auth-card">
        <div className="sv-auth-brand">
          <img src={logo} alt="" />
          <h1>Criar conta</h1>
          <p>Comece a monitorar suas placas solares.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-floating mb-3">
            <input
              id="auth-nome"
              type="text"
              className="form-control"
              placeholder="Nome"
              maxLength={100}
              value={form.nome}
              onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
              required
            />
            <label htmlFor="auth-nome">Nome</label>
          </div>
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
              minLength={8}
              required
            />
            <label htmlFor="auth-senha">Senha (mínimo 8 caracteres)</label>
          </div>
          <div className="form-floating mb-3">
            <input
              id="auth-confirmar-senha"
              type="password"
              className="form-control"
              placeholder="Confirmar senha"
              value={form.confirmarSenha}
              onChange={(event) =>
                setForm((current) => ({ ...current, confirmarSenha: event.target.value }))
              }
              required
            />
            <label htmlFor="auth-confirmar-senha">Confirmar senha</label>
          </div>

          {error ? <div className="alert alert-danger">{error}</div> : null}

          <button type="submit" className="btn btn-primary btn-lg w-100" disabled={loading}>
            {loading ? "Criando conta..." : "Registrar-se"}
          </button>
        </form>

        <p className="sv-auth-foot">
          Já possui uma conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
