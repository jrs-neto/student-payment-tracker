import { Router } from "express";
import { studentController } from "../controllers/studentController.js";

const router = Router();

router.post("/", studentController.create);
router.get("/", studentController.list);
router.get("/:id", studentController.getById);
router.put("/:id", studentController.update);
router.patch("/:id/status", studentController.updateStatus);

export default router;
