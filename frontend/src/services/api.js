import axios from "axios";

const rawApiUrl = import.meta.env.VITE_API_URL?.trim();

const baseURL = rawApiUrl ? `${rawApiUrl.replace(/\/+$/, "")}/api` : "/api";

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor de requisição: adiciona o JWT quando disponível.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor de resposta: trata sessões inválidas ou expiradas.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || "";

    const isLoginRoute = requestUrl.includes("/auth/login");
    const isRegisterRoute = requestUrl.includes("/auth/register");
    const isMeRoute = requestUrl.includes("/auth/me");

    const isPublicAuthRoute = isLoginRoute || isRegisterRoute;

    if (status === 401 && !isPublicAuthRoute) {
      localStorage.removeItem("token");

      window.dispatchEvent(new Event("auth:unauthorized"));

      // A verificação /auth/me também precisa encerrar uma sessão inválida.
      // Evita redirecionamentos repetidos quando já estamos na tela inicial.
      if (window.location.pathname !== "/") {
        window.location.replace("/");
      }
    }

    return Promise.reject(error);
  },
);

export default api;
