import { studentToolDeclarations, executeStudentTool } from "./studentTools.js";

import { paymentToolDeclarations, executePaymentTool } from "./paymentTools.js";

// Reúne todas as ferramentas disponíveis para os provedores de IA
export const toolDeclarations = [...studentToolDeclarations, ...paymentToolDeclarations];

// Executa exclusivamente ferramentas autorizadas
export async function executeTool(name, args = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Os argumentos da ferramenta são inválidos.");
  }

  switch (name) {
    case "getStudentCount":
      return await executeStudentTool(name);

    case "getMonthlyFinancialSummary":
    case "getMonthlyPaymentsByStatus":
      return await executePaymentTool(name, args);

    default:
      throw new Error(`Ferramenta não autorizada: ${name}`);
  }
}
