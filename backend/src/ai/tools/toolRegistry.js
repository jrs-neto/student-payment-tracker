import { studentToolDeclarations, executeStudentTool } from "./studentTools.js";

import { paymentToolDeclarations, executePaymentTool } from "./paymentTools.js";

// Reúne todas as ferramentas disponíveis para os provedores de IA.
export const toolDeclarations = [...studentToolDeclarations, ...paymentToolDeclarations];

// Executa exclusivamente ferramentas autorizadas.
export async function executeTool(name, args = {}, userId) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("Usuário inválido.");
  }

  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Os argumentos da ferramenta são inválidos.");
  }

  switch (name) {
    case "getStudentCount":
      return await executeStudentTool(name, userId, args);

    case "getMonthlyFinancialSummary":
    case "getMonthlyPaymentsByStatus":
      return await executePaymentTool(name, args, userId);

    default:
      throw new Error(`Ferramenta não autorizada: ${name}`);
  }
}
