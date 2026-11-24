import { authService } from "../services/authService.js";

export const authController = {
  async demoLogin(req, res, next) {
    try {
      const result = await authService.demoLogin();
      return res.status(200).json({ user: result.user, token: result.token });
    } catch (error) {
      next(error);
    }
  },

  async register(req, res, next) {
    try {
      const { name, email, password } = req.body ?? {};

      const result = await authService.register({
        name,
        email,
        password,
      });

      return res.status(201).json({
        message: "Conta criada com sucesso.",
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      next(error);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body ?? {};

      const result = await authService.login({
        email,
        password,
      });

      return res.status(200).json({
        message: "Login realizado com sucesso.",
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      next(error);
    }
  },

  async googleLogin(req, res, next) {
    try {
      const { idToken } = req.body ?? {};

      const result = await authService.googleLogin({
        idToken,
      });

      return res.status(200).json({
        message: "Autenticação Google realizada com sucesso.",
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      next(error);
    }
  },

  async linkGoogle(req, res, next) {
    try {
      const { password, idToken } = req.body ?? {};

      const result = await authService.linkGoogle({
        userId: req.user.id,
        password,
        idToken,
      });

      return res.status(200).json({
        message: result.alreadyLinked
          ? "Esta conta Google já estava vinculada."
          : "Conta Google vinculada com sucesso.",
        user: result.user,
        alreadyLinked: result.alreadyLinked,
      });
    } catch (error) {
      next(error);
    }
  },

  async claimLegacy(req, res, next) {
    try {
      const { name, email, password, claimSecret } = req.body ?? {};

      const result = await authService.claimLegacy({
        name,
        email,
        password,
        claimSecret,
      });

      return res.status(200).json({
        message: "Conta recuperada com sucesso.",
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      next(error);
    }
  },

  me(req, res) {
    return res.status(200).json({
      user: req.user,
    });
  },
};
