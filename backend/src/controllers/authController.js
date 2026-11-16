import { authService } from "../services/authService.js";

export const authController = {
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
