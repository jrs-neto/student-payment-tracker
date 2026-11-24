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

    const normalizedRequestUrl = requestUrl.split("?")[0].replace(/\/+$/, "");
    const isLoginRoute = normalizedRequestUrl === "/auth/login";
    const isRegisterRoute = normalizedRequestUrl === "/auth/register";
    const isGoogleRoute = normalizedRequestUrl === "/auth/google";
    const isGoogleLinkRoute = normalizedRequestUrl === "/auth/google/link";

    const isPublicAuthRoute = isLoginRoute || isRegisterRoute || isGoogleRoute;
    const googleLinkErrorCode = error.response?.data?.error?.code;
    const isGoogleLinkAuthRequired =
      isGoogleLinkRoute && googleLinkErrorCode === "AUTH_REQUIRED";
    const isGoogleLinkInvalidPassword =
      isGoogleLinkRoute && googleLinkErrorCode === "INVALID_PASSWORD";

    if (
      status === 401 &&
      !isPublicAuthRoute &&
      (!isGoogleLinkRoute || isGoogleLinkAuthRequired) &&
      !isGoogleLinkInvalidPassword
    ) {
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
