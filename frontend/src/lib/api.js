import axios from "axios";

const api = axios.create({
  baseURL: "/",
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("solarVisionToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function extractErrorMessage(error) {
  // Sem resposta do servidor (rede fora do ar / backend indisponível)
  if (error?.request && !error?.response) {
    return "Não foi possível conectar ao servidor. Tente novamente em instantes.";
  }

  const data = error?.response?.data;

  // Erros de validação por campo (HTTP 400): { errors: { campo: "mensagem" } }
  if (data?.errors && typeof data.errors === "object") {
    const mensagens = Object.values(data.errors).filter(Boolean);
    if (mensagens.length > 0) {
      return mensagens.join(" · ");
    }
  }

  return (
    data?.message ||
    data?.error ||
    "Não foi possível concluir a operação."
  );
}

export default api;
