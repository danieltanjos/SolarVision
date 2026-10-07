import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, supabase } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = ainda lendo a sessão salva; null = deslogado.
  const [session, setSession] = useState(undefined);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // O Supabase persiste a sessão (JWT + refresh) no localStorage e emite INITIAL_SESSION ao assinar.
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) {
      setUser(null);
      return;
    }
    let ativo = true; // ignora a resposta se o usuário mudar (logout/login) antes dela chegar
    getCurrentUser().then(
      (perfil) => ativo && setUser(perfil),
      (error) => {
        console.error("Não foi possível carregar o perfil do usuário.", error);
        if (ativo) setUser(null);
      }
    );
    return () => {
      ativo = false;
    };
  }, [userId]);

  async function login({ email, senha }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
  }

  async function register({ nome, email, senha }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome: nome.trim() } }
    });
    if (error) throw error;
    // Sem sessão = "Confirm email" ligado no Supabase Auth.
    if (!data.session) throw new Error("Conta criada. Confirme seu e-mail para entrar.");
  }

  // "local": só esta sessão; "global": todos os dispositivos (o padrão do supabase-js).
  function logout(scope = "local") {
    return supabase.auth.signOut({ scope });
  }

  // Confere a senha atual com um novo login antes de trocar: a sessão aberta sozinha não prova quem está no teclado.
  async function trocarSenha(atual, nova) {
    const login = await supabase.auth.signInWithPassword({ email: user.email, password: atual });
    if (login.error) {
      throw login.error.message === "Invalid login credentials" ? new Error("A senha atual está incorreta.") : login.error;
    }
    const { error } = await supabase.auth.updateUser({ password: nova });
    if (error) throw error;
  }

  // Depois de salvar o perfil/preferências.
  async function recarregarUsuario() {
    setUser(await getCurrentUser());
  }

  if (session === undefined) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: Boolean(session),
        user,
        login,
        register,
        logout,
        trocarSenha,
        recarregarUsuario
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Perda por sujeira (0 a 0,20) a partir da qual a limpeza é recomendada: a preferência do usuário (padrão 10 %).
export function useLimiarLimpeza() {
  return useAuth().user?.limiarLimpeza ?? 0.1;
}
