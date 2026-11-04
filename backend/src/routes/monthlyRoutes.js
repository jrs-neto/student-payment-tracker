import { Router } from "express";
import { monthlyController } from "../controllers/monthlyController.js";

const router = Router();

// Rotas de meses de referência e cópia
router.get("/months", monthlyController.listMonths);
router.post("/months/copy", monthlyController.copyMonthRecords);
router.delete("/months/:id", monthlyController.deleteMonth); // Nova rota de exclusão de mês inteiro[cite: 1]
router.get("/months/:reference_id/records", monthlyController.getMonthRecords);
router.post("/months/:reference_id/records", monthlyController.createRecord);

// Rotas de manipulação direta de registros mensais específicos
router.put("/months/records/:id", monthlyController.updateRecord);
router.patch("/months/records/:id/payment", monthlyController.updateRecordPayment);
router.delete("/months/records/:id", monthlyController.deleteRecord);

export default router;
