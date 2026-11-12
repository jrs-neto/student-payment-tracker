import { Router } from "express";
import { assistantController } from "../controllers/assistantController.js";
import { assistantRateLimiter } from "../middlewares/assistantRateLimiter.js";

const router = Router();

router.post("/message", assistantRateLimiter, assistantController.sendMessage);

export default router;
