import { Router } from "express";

import { studentController } from "../controllers/studentController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { readOnlyDemoMiddleware } from "../middlewares/readOnlyDemoMiddleware.js";

const router = Router();

// Todas as rotas de alunos exigem autenticação.
router.use(authMiddleware);

router.post("/", readOnlyDemoMiddleware, studentController.create);
router.get("/", studentController.list);
router.get("/:id", studentController.getById);
router.put("/:id", readOnlyDemoMiddleware, studentController.update);
router.patch("/:id/status", readOnlyDemoMiddleware, studentController.updateStatus);

export default router;
