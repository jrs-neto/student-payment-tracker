import { studentModel } from "../../models/studentModel.js";

// Declaração das ferramentas disponíveis para os provedores de IA.
export const studentToolDeclarations = [
  {
    type: "function",
    name: "getStudentCount",
    description:
      "Retorna a quantidade total de alunos cadastrados no sistema, incluindo alunos ativos e inativos. Utilize quando o usuário perguntar quantos alunos estão cadastrados ou solicitar o total de alunos registrados.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

// Execução das ferramentas no backend.
export async function executeStudentTool(name, userId, args = {}) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("Usuário inválido.");
  }

  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Os argumentos da ferramenta são inválidos.");
  }

  switch (name) {
    case "getStudentCount": {
      const totalStudents = await studentModel.countAll(userId);

      return {
        totalStudents,
      };
    }

    default:
      throw new Error(`Ferramenta não autorizada: ${name}`);
  }
}
