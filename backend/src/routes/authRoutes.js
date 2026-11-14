import { Router } from "express";
import rateLimit from "express-rate-limit";

import { authController } from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

// Limita tentativas de cadastro e login por endereço IP.
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

// Rotas públicas
router.post("/register", authRateLimiter, authController.register);
router.post("/login", authRateLimiter, authController.login);

// Rota protegida
router.get("/me", authMiddleware, authController.me);

export default router;
