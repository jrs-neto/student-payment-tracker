import { monthlyModel } from "../../models/monthlyModel.js";
import { monthlyService } from "../../services/monthlyService.js";

// Declaração das ferramentas disponíveis para os provedores de IA
export const paymentToolDeclarations = [
  {
    type: "function",
    name: "getMonthlyFinancialSummary",
    description:
      "Consulta o resumo financeiro de um mês de referência. Se o resultado retornar found: false, informe ao usuário que o mês não está cadastrado na base de dados. Não apresente valores zerados como se fossem dados financeiros consultados.",
    parameters: {
      type: "object",
      properties: {
        year: {
          type: "integer",
          description: "Ano de referência. Se omitido, utiliza o ano atual.",
        },
        month: {
          type: "integer",
          description: "Mês de referência, de 1 a 12. Se omitido, utiliza o mês atual.",
        },
      },
    },
  },
  {
    type: "function",
    name: "getMonthlyPaymentsByStatus",
    description:
      "Lista as mensalidades de um mês de referência filtradas por status: Pago, Pendente, Atrasado ou Todos. Se o resultado retornar found: false, informe que o mês não está cadastrado na base de dados e que não foi possível consultar mensalidades desse período.",
    parameters: {
      type: "object",
      properties: {
        year: {
          type: "integer",
          description: "Ano de referência. Se omitido, utiliza o ano atual.",
        },
        month: {
          type: "integer",
          description: "Mês de referência, de 1 a 12. Se omitido, utiliza o mês atual.",
        },
        status: {
          type: "string",
          enum: ["Pago", "Pendente", "Atrasado", "Todos"],
          description: "Status das mensalidades que devem ser consultadas.",
        },
      },
      required: ["status"],
    },
  },
];

// Obtém o ano e o mês atuais em America/Sao_Paulo
function getCurrentReferenceDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === "year").value),
    month: Number(parts.find((part) => part.type === "month").value),
  };
}

// Valida os argumentos recebidos
function validateArguments(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Os argumentos da ferramenta são inválidos.");
  }
}

// Valida os parâmetros de referência
function validateReferenceDate(year, month) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Ano ou mês de referência inválido.");
  }
}

// Localiza o mês de referência
async function findReferenceMonth(year, month) {
  return await monthlyModel.findMonthByYearAndMonth(year, month);
}

// Formata o nome do mês
function getMonthName(month) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(Date.UTC(2026, month - 1, 15)));
}

// Executa as ferramentas autorizadas pelo backend
export async function executePaymentTool(name, args = {}) {
  validateArguments(args);

  switch (name) {
    case "getMonthlyFinancialSummary": {
      const currentDate = getCurrentReferenceDate();

      const year = args.year ?? currentDate.year;
      const month = args.month ?? currentDate.month;

      validateReferenceDate(year, month);

      const referenceMonth = await findReferenceMonth(year, month);

      if (!referenceMonth) {
        return {
          found: false,
          year,
          month,
          message: `Não foi encontrado um mês de referência cadastrado para ${getMonthName(month)} de ${year}.`,
        };
      }

      const summary = await monthlyModel.getMonthFinancialSummary(referenceMonth.id);

      return {
        found: true,
        year: referenceMonth.year,
        month: referenceMonth.month,
        total_expected: summary.total_expected,
        total_paid: summary.total_paid,
        total_pending: summary.total_pending,
      };
    }

    case "getMonthlyPaymentsByStatus": {
      const currentDate = getCurrentReferenceDate();

      const year = args.year ?? currentDate.year;
      const month = args.month ?? currentDate.month;
      const { status } = args;

      validateReferenceDate(year, month);

      const allowedStatuses = ["Pago", "Pendente", "Atrasado", "Todos"];

      if (!allowedStatuses.includes(status)) {
        throw new Error("Status de pagamento inválido.");
      }

      const referenceMonth = await findReferenceMonth(year, month);

      if (!referenceMonth) {
        return {
          found: false,
          year,
          month,
          status,
          message: `Não foi encontrado um mês de referência cadastrado para ${getMonthName(month)} de ${year}.`,
          total_records: 0,
          total_amount: "0.00",
          records: [],
        };
      }

      const monthData = await monthlyService.getMonthRecords(referenceMonth.id);

      const records =
        status === "Todos" ? monthData.records : monthData.records.filter((record) => record.status === status);

      const totalCents = records.reduce((total, record) => total + Math.round(Number(record.amount) * 100), 0);

      return {
        found: true,
        year: referenceMonth.year,
        month: referenceMonth.month,
        status,
        total_records: records.length,
        total_amount: (totalCents / 100).toFixed(2),
        records: records.map((record) => ({
          student_name: record.student_name,
          amount: record.amount,
          due_date: record.due_date,
          status: record.status,
        })),
      };
    }

    default:
      throw new Error(`Ferramenta não autorizada: ${name}`);
  }
}
