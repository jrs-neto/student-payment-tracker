import { Router } from "express";

import { monthlyController } from "../controllers/monthlyController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

// Todas as rotas de mensalidades exigem autenticação.
router.use(authMiddleware);

// Rotas de meses de referência e cópia.
router.get("/months", monthlyController.listMonths);
router.post("/months/copy", monthlyController.copyMonthRecords);
router.delete("/months/:id", monthlyController.deleteMonth);
router.get("/months/:reference_id/records", monthlyController.getMonthRecords);
router.post("/months/:reference_id/records", monthlyController.createRecord);

// Rotas de manipulação direta de registros mensais específicos.
router.put("/months/records/:id", monthlyController.updateRecord);
router.patch("/months/records/:id/payment", monthlyController.updateRecordPayment);
router.delete("/months/records/:id", monthlyController.deleteRecord);

export default router;
