import { Router } from "express";

import { studentController } from "../controllers/studentController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

// Todas as rotas de alunos exigem autenticação.
router.use(authMiddleware);

router.post("/", studentController.create);
router.get("/", studentController.list);
router.get("/:id", studentController.getById);
router.put("/:id", studentController.update);
router.patch("/:id/status", studentController.updateStatus);

export default router;
