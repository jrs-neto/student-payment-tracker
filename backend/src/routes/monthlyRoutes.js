import { Router } from "express";

import { monthlyController } from "../controllers/monthlyController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { readOnlyDemoMiddleware } from "../middlewares/readOnlyDemoMiddleware.js";

const router = Router();

// Todas as rotas de mensalidades exigem autenticação.
router.use(authMiddleware);

// Rotas de meses de referência e cópia.
router.get("/months", monthlyController.listMonths);
router.post("/months", readOnlyDemoMiddleware, monthlyController.createMonth);
router.post("/months/copy", readOnlyDemoMiddleware, monthlyController.copyMonthRecords);
router.delete("/months/:id", readOnlyDemoMiddleware, monthlyController.deleteMonth);
router.get("/months/:reference_id/records", monthlyController.getMonthRecords);
router.post("/months/:reference_id/records", readOnlyDemoMiddleware, monthlyController.createRecord);

// Rotas de manipulação direta de registros mensais específicos.
router.put("/months/records/:id", readOnlyDemoMiddleware, monthlyController.updateRecord);
router.patch("/months/records/:id/payment", readOnlyDemoMiddleware, monthlyController.updateRecordPayment);
router.delete("/months/records/:id", readOnlyDemoMiddleware, monthlyController.deleteRecord);

export default router;
