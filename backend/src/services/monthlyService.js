import pool from "../config/database.js";
import { monthlyModel } from "../models/monthlyModel.js";

// Utilitário para validar ID inteiro positivo
const isValidId = (idParam) => {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0;
};

// Validador estrito de payload (rejeita null, arrays e primitivos)
const validateAllowedKeys = (payload, allowedKeys) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  const keys = Object.keys(payload);
  if (keys.length === 0) return false;
  return keys.every((key) => allowedKeys.includes(key));
};

// Validação estrita de data YYYY-MM-DD
const isValidDateString = (dateStr) => {
  if (typeof dateStr !== "string") return false;
  const regex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateStr.match(regex);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;

  const daysInMonths = [
    31,
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (day < 1 || day > daysInMonths[month - 1]) return false;

  return true;
};

// Validação estrita para valores monetários NUMERIC(10,2) - rejeita zero e negativos
const isValidAmount = (amount) => {
  if (amount === null || amount === undefined) return false;

  let strValue;
  if (typeof amount === "number") {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    strValue = amount.toString();
  } else if (typeof amount === "string") {
    strValue = amount.trim();
    if (strValue === "") return false;
  } else {
    return false;
  }

  const monetaryRegex = /^(?:[1-9]\d{0,7}(?:\.\d{1,2})?|0\.[1-9]\d?|0\.0[1-9])$/;
  return monetaryRegex.test(strValue);
};

// Obtém a data atual no formato YYYY-MM-DD baseada no fuso America/Sao_Paulo
const getCurrentDateInSaoPaulo = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
};

// Extrai a data civil no formato YYYY-MM-DD sem deslocamentos de fuso horário
const formatCivilDate = (dateValue) => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) {
    const year = dateValue.getUTCFullYear();
    const month = String(dateValue.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dateValue.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const str = String(dateValue);
  return str.includes("T") ? str.split("T")[0] : str.substring(0, 10);
};

// Cálculo dinâmico do status do registro mensal
const calculateStatus = (isPaid, dueDateStr) => {
  if (isPaid === true) {
    return "Pago";
  }
  const currentDateStr = getCurrentDateInSaoPaulo();
  if (currentDateStr <= dueDateStr) {
    return "Pendente";
  }
  return "Atrasado";
};

export const monthlyService = {
  async listMonths() {
    return await monthlyModel.findAllMonths();
  },

  async getMonthRecords(referenceIdParam) {
    if (!isValidId(referenceIdParam)) {
      const error = new Error("ID de mês de referência inválido.");
      error.status = 400;
      throw error;
    }
    const referenceId = Number(referenceIdParam);

    const month = await monthlyModel.findMonthById(referenceId);
    if (!month) {
      const error = new Error("Mês de referência não encontrado.");
      error.status = 404;
      throw error;
    }

    const rawRecords = await monthlyModel.findRecordsByMonthId(referenceId);
    const records = rawRecords.map((record) => {
      const dueDateFormatted = formatCivilDate(record.due_date);

      return {
        ...record,
        due_date: dueDateFormatted,
        status: calculateStatus(record.is_paid, dueDateFormatted),
      };
    });

    const summary = await monthlyModel.getMonthFinancialSummary(referenceId);

    return {
      reference_month: month,
      summary,
      records,
    };
  },

  async createRecord(referenceIdParam, body) {
    if (!isValidId(referenceIdParam)) {
      const error = new Error("ID de mês de referência inválido.");
      error.status = 400;
      throw error;
    }
    const referenceId = Number(referenceIdParam);

    const month = await monthlyModel.findMonthById(referenceId);
    if (!month) {
      const error = new Error("Mês de referência não encontrado.");
      error.status = 404;
      throw error;
    }

    const allowedKeys = ["student_id", "student_name", "amount", "due_date"];
    if (!validateAllowedKeys(body, allowedKeys)) {
      const error = new Error(
        "Payload inválido. Exige estritamente e apenas os campos student_id, student_name, amount e due_date.",
      );
      error.status = 400;
      throw error;
    }

    const { student_id, student_name, amount, due_date } = body;

    if (!isValidId(student_id)) {
      const error = new Error("O campo student_id deve ser um ID de aluno válido.");
      error.status = 400;
      throw error;
    }

    if (!student_name || typeof student_name !== "string" || student_name.trim() === "" || student_name.length > 150) {
      const error = new Error("O campo student_name é obrigatório e deve ter no máximo 150 caracteres.");
      error.status = 400;
      throw error;
    }

    if (!isValidAmount(amount)) {
      const error = new Error(
        "O campo amount deve ser um valor monetário válido, maior que zero, com no máximo 8 dígitos inteiros e 2 casas decimais.",
      );
      error.status = 400;
      throw error;
    }

    if (!isValidDateString(due_date)) {
      const error = new Error("O campo due_date deve ser uma data real válida no formato YYYY-MM-DD.");
      error.status = 400;
      throw error;
    }

    const student = await monthlyModel.findStudentById(student_id);
    if (!student) {
      const error = new Error("Aluno não encontrado.");
      error.status = 404;
      throw error;
    }

    if (student.is_active !== true) {
      const error = new Error("Não é permitido adicionar um aluno inativo a um mês de referência.");
      error.status = 400;
      throw error;
    }

    try {
      const normalizedAmount = typeof amount === "number" ? amount.toString() : amount.trim();

      const createdRecord = await monthlyModel.createRecord({
        student_id: Number(student_id),
        reference_month_id: referenceId,
        student_name: student_name.trim(),
        amount: normalizedAmount,
        due_date,
      });

      const dueDateFormatted = formatCivilDate(createdRecord.due_date);

      return {
        ...createdRecord,
        due_date: dueDateFormatted,
        status: calculateStatus(createdRecord.is_paid, dueDateFormatted),
      };
    } catch (dbError) {
      if (dbError.code === "23505" && dbError.constraint === "uk_student_reference_month") {
        const error = new Error("Este aluno já possui um registro neste mês de referência.");
        error.status = 409;
        throw error;
      }
      throw dbError;
    }
  },

  async updateRecord(recordIdParam, body) {
    if (!isValidId(recordIdParam)) {
      const error = new Error("ID do registro mensal inválido.");
      error.status = 400;
      throw error;
    }
    const recordId = Number(recordIdParam);

    const allowedKeys = ["amount", "due_date"];
    if (!validateAllowedKeys(body, allowedKeys)) {
      const error = new Error("Payload inválido. A edição exige estritamente e apenas os campos amount e due_date.");
      error.status = 400;
      throw error;
    }

    const { amount, due_date } = body;

    if (amount === undefined || due_date === undefined) {
      const error = new Error("Os campos amount e due_date são obrigatórios.");
      error.status = 400;
      throw error;
    }

    if (!isValidAmount(amount)) {
      const error = new Error(
        "O campo amount deve ser um valor monetário válido, maior que zero, com no máximo 8 dígitos inteiros e 2 casas decimais.",
      );
      error.status = 400;
      throw error;
    }

    if (!isValidDateString(due_date)) {
      const error = new Error("O campo due_date deve ser uma data real válida no formato YYYY-MM-DD.");
      error.status = 400;
      throw error;
    }

    const existingRecord = await monthlyModel.findRecordById(recordId);
    if (!existingRecord) {
      const error = new Error("Registro mensal não encontrado.");
      error.status = 404;
      throw error;
    }

    const normalizedAmount = typeof amount === "number" ? amount.toString() : amount.trim();

    const updatedRecord = await monthlyModel.updateRecord(recordId, {
      student_name: existingRecord.student_name,
      amount: normalizedAmount,
      due_date,
    });

    if (!updatedRecord) {
      const error = new Error("Registro mensal não encontrado.");
      error.status = 404;
      throw error;
    }

    const dueDateFormatted = formatCivilDate(updatedRecord.due_date);

    return {
      ...updatedRecord,
      due_date: dueDateFormatted,
      status: calculateStatus(updatedRecord.is_paid, dueDateFormatted),
    };
  },

  async updateRecordPayment(recordIdParam, body) {
    if (!isValidId(recordIdParam)) {
      const error = new Error("ID do registro mensal inválido.");
      error.status = 400;
      throw error;
    }
    const recordId = Number(recordIdParam);

    const allowedKeys = ["is_paid"];
    if (!validateAllowedKeys(body, allowedKeys)) {
      const error = new Error(
        "Payload inválido. A alteração de pagamento exige estritamente e apenas o campo booleano is_paid.",
      );
      error.status = 400;
      throw error;
    }

    const { is_paid } = body;
    if (typeof is_paid !== "boolean") {
      const error = new Error("O campo is_paid deve ser estritamente um valor booleano (true ou false).");
      error.status = 400;
      throw error;
    }

    const existingRecord = await monthlyModel.findRecordById(recordId);
    if (!existingRecord) {
      const error = new Error("Registro mensal não encontrado.");
      error.status = 404;
      throw error;
    }

    const updatedRecord = await monthlyModel.updateRecordPaymentStatus(recordId, is_paid);

    if (!updatedRecord) {
      const error = new Error("Registro mensal não encontrado.");
      error.status = 404;
      throw error;
    }

    const dueDateFormatted = formatCivilDate(updatedRecord.due_date);

    return {
      ...updatedRecord,
      due_date: dueDateFormatted,
      status: calculateStatus(updatedRecord.is_paid, dueDateFormatted),
    };
  },

  async deleteRecord(recordIdParam) {
    if (!isValidId(recordIdParam)) {
      const error = new Error("ID do registro mensal inválido.");
      error.status = 400;
      throw error;
    }
    const recordId = Number(recordIdParam);

    const deletedRecord = await monthlyModel.deleteRecord(recordId);
    if (!deletedRecord) {
      const error = new Error("Registro mensal não encontrado para exclusão.");
      error.status = 404;
      throw error;
    }

    const dueDateFormatted = formatCivilDate(deletedRecord.due_date);

    return {
      ...deletedRecord,
      due_date: dueDateFormatted,
      status: calculateStatus(deletedRecord.is_paid, dueDateFormatted),
    };
  },

  // Copiar registros de um mês de origem para um mês de destino com transação segura
  async copyMonthRecords(body) {
    const allowedKeys = ["source_reference_id", "target_year", "target_month"];
    if (!validateAllowedKeys(body, allowedKeys)) {
      const error = new Error(
        "Payload inválido. Exige estritamente e apenas os campos source_reference_id, target_year e target_month.",
      );
      error.status = 400;
      throw error;
    }

    const { source_reference_id, target_year, target_month } = body;

    if (!isValidId(source_reference_id)) {
      const error = new Error("O campo source_reference_id deve ser um ID de mês de referência válido.");
      error.status = 400;
      throw error;
    }

    if (typeof target_year !== "number" || !Number.isInteger(target_year) || target_year < 2000 || target_year > 2100) {
      const error = new Error("O campo target_year deve ser um ano válido entre 2000 e 2100.");
      error.status = 400;
      throw error;
    }

    if (typeof target_month !== "number" || !Number.isInteger(target_month) || target_month < 1 || target_month > 12) {
      const error = new Error("O campo target_month deve ser um mês válido entre 1 e 12.");
      error.status = 400;
      throw error;
    }

    const sourceMonth = await monthlyModel.findMonthById(Number(source_reference_id));
    if (!sourceMonth) {
      const error = new Error("Mês de referência de origem não encontrado.");
      error.status = 404;
      throw error;
    }

    const existingTargetMonth = await monthlyModel.findMonthByYearAndMonth(target_year, target_month);
    if (existingTargetMonth) {
      const error = new Error("O mês de referência de destino já existe.");
      error.status = 409;
      throw error;
    }

    const sourceRecords = await monthlyModel.findRecordsByMonthId(Number(source_reference_id));

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      let targetMonth;
      try {
        targetMonth = await monthlyModel.createMonthWithClient(client, {
          year: target_year,
          month: target_month,
        });
      } catch (dbError) {
        if (dbError.code === "23505" && dbError.constraint === "uk_year_month") {
          const error = new Error("O mês de referência de destino já existe.");
          error.status = 409;
          throw error;
        }
        throw dbError;
      }

      const copiedRecords = [];
      const getLastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

      for (const record of sourceRecords) {
        if (!record.due_date) {
          const error = new Error("Inconsistência de dados: registro de origem possui due_date inválido ou ausente.");
          error.status = 400;
          throw error;
        }

        const originalDateStr = formatCivilDate(record.due_date);
        const parts = originalDateStr.split("-");
        if (parts.length !== 3) {
          const error = new Error("Inconsistência de dados: formato de data de vencimento inválido na origem.");
          error.status = 400;
          throw error;
        }

        const originalDueDay = parseInt(parts[2], 10);

        const lastDayOfTarget = getLastDayOfMonth(target_year, target_month);
        const adjustedDay = Math.min(originalDueDay, lastDayOfTarget);
        const targetDueDayStr = String(adjustedDay).padStart(2, "0");
        const targetMonthStr = String(target_month).padStart(2, "0");
        const newDueDate = `${target_year}-${targetMonthStr}-${targetDueDayStr}`;

        const newRecord = await monthlyModel.createRecordWithClient(client, {
          student_id: record.student_id,
          reference_month_id: targetMonth.id,
          student_name: record.student_name,
          amount: record.amount,
          due_date: newDueDate,
        });

        copiedRecords.push(newRecord);
      }

      await client.query("COMMIT");

      return {
        message: "Registros copiados com sucesso.",
        target_reference_month: targetMonth,
        copied_count: copiedRecords.length,
      };
    } catch (transactionError) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Erro crítico ao executar ROLLBACK:", rollbackError);
        }
      }
      throw transactionError;
    } finally {
      client.release();
    }
  },

  async deleteMonth(monthId) {
    const numericMonthId = Number(monthId);
    if (!monthId || isNaN(numericMonthId) || numericMonthId <= 0) {
      const error = new Error("ID do mês de referência inválido.");
      error.status = 400;
      throw error;
    }

    const existingMonth = await monthlyModel.findMonthById(numericMonthId);
    if (!existingMonth) {
      const error = new Error("Mês de referência não encontrado.");
      error.status = 404;
      throw error;
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const deletedRecords = await monthlyModel.deleteRecordsByReferenceIdWithClient(client, numericMonthId);
      const deletedMonth = await monthlyModel.deleteMonthWithClient(client, numericMonthId);

      await client.query("COMMIT");

      return {
        message: "Mês de referência e mensalidades excluídos com sucesso.",
        deletedMonth,
        deletedRecordsCount: deletedRecords.length,
      };
    } catch (err) {
      console.error("ERRO DETALHADO NA EXCLUSÃO DO MÊS:", err);
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Erro crítico ao executar ROLLBACK:", rollbackErr);
        }
      }
      throw err;
    } finally {
      client.release();
    }
  },
};
