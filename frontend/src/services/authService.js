import api from "./api";

export const authService = {
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
  async getMe() {
    const response = await api.get("/auth/me");
    return response.data;
  },

  // Encerra a sessão
  logout() {
    localStorage.removeItem("token");
  },
};
