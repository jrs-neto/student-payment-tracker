import api from "./api";

let pendingMeRequest = null;

export const authService = {
  async demoLogin() {
    const response = await api.post("/auth/demo");
    if (response.data?.token) localStorage.setItem("token", response.data.token);
    return response.data;
  },

  // Realiza o login
  async login(email, password) {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    if (response.data?.token) {
      localStorage.setItem("token", response.data.token);
    }

    return response.data;
  },

  // Realiza o login ou cadastro com Google
  async googleLogin(idToken) {
    const response = await api.post("/auth/google", {
      idToken,
    });

    if (response.data?.token) {
      localStorage.setItem("token", response.data.token);
    }

    return response.data;
  },

  async linkGoogle(password, idToken) {
    const response = await api.post("/auth/google/link", {
      password,
      idToken,
    });

    return response.data;
  },

  // Realiza o cadastro de um novo usuário
  async register(name, email, password) {
    const response = await api.post("/auth/register", {
      name,
      email,
      password,
    });

    if (response.data?.token) {
      localStorage.setItem("token", response.data.token);
    }

    return response.data;
  },

  // Reivindica a conta legada
  async claimLegacy(name, email, password, claimSecret) {
    const response = await api.post("/auth/claim-legacy", {
      name,
      email,
      password,
      claimSecret,
    });

    if (response.data?.token) {
      localStorage.setItem("token", response.data.token);
    }

    return response.data;
  },

  // Recupera os dados do usuário autenticado
  getMe() {
    const token = localStorage.getItem("token");

    // O StrictMode pode montar o App duas vezes em desenvolvimento. Compartilha
    // a validação em andamento para o mesmo token, inclusive quando ela falha.
    if (pendingMeRequest?.token === token) {
      return pendingMeRequest.promise;
    }

    const promise = api.get("/auth/me").then((response) => response.data);
    pendingMeRequest = { token, promise };

    promise
      .finally(() => {
        if (pendingMeRequest?.promise === promise) {
          pendingMeRequest = null;
        }
      })
      .catch(() => {
        // Mantém a rejeição original para os chamadores tratarem normalmente.
      });

    return promise;
  },

  // Encerra a sessão
  logout() {
    localStorage.removeItem("token");
  },
};
