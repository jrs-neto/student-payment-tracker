import { Router } from "express";

import { assistantController } from "../controllers/assistantController.js";
import { assistantRateLimiter } from "../middlewares/assistantRateLimiter.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

// Todas as operações do assistente exigem autenticação.
router.use(authMiddleware);

router.post("/message", assistantRateLimiter, assistantController.sendMessage);

export default router;
