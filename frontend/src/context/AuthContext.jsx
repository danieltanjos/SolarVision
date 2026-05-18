import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState
} from "react";
import api from "../lib/api";

const TOKEN_KEY = "solarVisionToken";
const USER_KEY = "solarVisionUser";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  async function login(credentials) {
    const { data } = await api.post("/api/auth/login", credentials);
    startTransition(() => {
      setToken(data.token);
      setUser(data.user);
    });
    return data;
  }

  async function register(payload) {
    const { data } = await api.post("/api/auth/register", payload);
    startTransition(() => {
      setToken(data.token);
      setUser(data.user);
    });
    return data;
  }

  async function refreshUser() {
    const { data } = await api.get("/api/users/me");
    setUser(data);
    return data;
  }

  function logout() {
    startTransition(() => {
      setToken(null);
      setUser(null);
    });
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: Boolean(token),
        token,
        user,
        login,
        register,
        refreshUser,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
