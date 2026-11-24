import { Router } from "express";
import rateLimit from "express-rate-limit";

import { authController } from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      status: 429,
      message: "Muitas tentativas. Tente novamente mais tarde.",
    },
  },
});

const googleRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      status: 429,
      message: "Muitas tentativas de autenticação com Google. Tente novamente mais tarde.",
    },
  },
});

const demoRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      status: 429,
      message: "Muitas tentativas de acesso à demonstração.",
    },
  },
});

// Rotas públicas
router.post("/register", authRateLimiter, authController.register);
router.post("/login", authRateLimiter, authController.login);
router.post("/google", googleRateLimiter, authController.googleLogin);
router.post("/google/link", authRateLimiter, authMiddleware, authController.linkGoogle);
router.post("/demo", demoRateLimiter, authController.demoLogin);
router.post("/claim-legacy", authRateLimiter, authController.claimLegacy);

// Rota protegida
router.get("/me", authMiddleware, authController.me);

export default router;
