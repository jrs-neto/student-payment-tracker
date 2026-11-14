import pool from "../config/database.js";
import { monthlyModel } from "../models/monthlyModel.js";

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  error.isSafe = true;
  return error;
}

function validateUserId(userId) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw createError("Usuário inválido.", 401);
  }
}

function isValidId(value) {
  return (
    (typeof value === "number" && Number.isSafeInteger(value) && value > 0) ||
    (typeof value === "string" && /^[1-9]\d*$/.test(value))
  );
}

function validateAllowedKeys(body, allowedKeys) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createError("Dados inválidos.", 400);
  }

  const unexpectedKeys = Object.keys(body).filter((key) => !allowedKeys.includes(key));

  if (unexpectedKeys.length > 0) {
    throw createError("Foram enviados campos não permitidos.", 400);
  }
}

function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidAmount(value) {
  if (typeof value !== "number" && typeof value !== "string") {
    return false;
  }

  const normalizedValue = typeof value === "string" ? value.trim() : String(value);

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    return false;
  }

  const amount = Number(normalizedValue);

  return Number.isFinite(amount) && amount > 0 && amount <= 999999999.99;
}

function getCurrentDateInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatCivilDate(value) {
  if (!value) return null;

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return null;
}

function calculateStatus(isPaid, dueDate) {
  if (isPaid) return "paid";

  const today = getCurrentDateInSaoPaulo();

  return dueDate < today ? "overdue" : "pending";
}

function validateReferenceId(referenceId) {
  if (!isValidId(referenceId)) {
    throw createError("ID do mês de referência inválido.", 400);
  }

  return Number(referenceId);
}

function validateRecordId(recordId) {
  if (!isValidId(recordId)) {
    throw createError("ID do registro inválido.", 400);
  }

  return Number(recordId);
}

export const monthlyService = {
  // Listar meses do usuário.
  async listMonths(userId) {
    validateUserId(userId);

    return monthlyModel.findAllMonths(userId);
  },

  // Buscar mensalidades e resumo financeiro de um mês.
  async getMonthRecords(referenceIdParam, userId) {
    validateUserId(userId);

    const referenceId = validateReferenceId(referenceIdParam);

    const month = await monthlyModel.findMonthById(referenceId, userId);

    if (!month) {
      throw createError("Mês de referência não encontrado.", 404);
    }

    const records = await monthlyModel.findRecordsByMonthId(referenceId, userId);

    const financialSummary = await monthlyModel.getMonthFinancialSummary(referenceId, userId);

    const formattedRecords = records.map((record) => {
      const dueDate = formatCivilDate(record.due_date);

      return {
        ...record,
        due_date: dueDate,
        status: calculateStatus(record.is_paid, dueDate),
      };
    });

    return {
      month,
      records: formattedRecords,
      financialSummary,
    };
  },

  // Criar mensalidade.
  async createRecord(referenceIdParam, body, userId) {
    validateUserId(userId);

    const referenceId = validateReferenceId(referenceIdParam);

    const allowedKeys = ["student_id", "student_name", "amount", "due_date"];

    validateAllowedKeys(body, allowedKeys);

    const { student_id, student_name, amount, due_date } = body;

    if (!isValidId(student_id)) {
      throw createError("ID do aluno inválido.", 400);
    }

    if (typeof student_name !== "string" || !student_name.trim() || student_name.trim().length > 150) {
      throw createError("Nome do aluno inválido.", 400);
    }

    if (!isValidAmount(amount)) {
      throw createError("Valor da mensalidade inválido.", 400);
    }

    if (!isValidDateString(due_date)) {
      throw createError("Data de vencimento inválida.", 400);
    }

    const month = await monthlyModel.findMonthById(referenceId, userId);

    if (!month) {
      throw createError("Mês de referência não encontrado.", 404);
    }

    const student = await monthlyModel.findStudentById(Number(student_id), userId);

    if (!student) {
      throw createError("Aluno não encontrado.", 404);
    }

    if (student.is_active !== true) {
      throw createError("Não é permitido adicionar um aluno inativo a um mês de referência.", 400);
    }

    try {
      const normalizedAmount = typeof amount === "number" ? amount.toString() : amount.trim();

      const createdRecord = await monthlyModel.createRecord(
        {
          student_id: Number(student_id),
          reference_month_id: referenceId,
          student_name: student_name.trim(),
          amount: normalizedAmount,
          due_date,
        },
        userId,
      );

      const dueDateFormatted = formatCivilDate(createdRecord.due_date);

      return {
        ...createdRecord,
        due_date: dueDateFormatted,
        status: calculateStatus(createdRecord.is_paid, dueDateFormatted),
      };
    } catch (dbError) {
      if (dbError.code === "23505" && dbError.constraint === "uk_student_reference_month") {
        throw createError("Este aluno já possui um registro neste mês de referência.", 409);
      }

      throw dbError;
    }
  },

  // Atualizar dados de uma mensalidade.
  async updateRecord(recordIdParam, body, userId) {
    validateUserId(userId);

    const recordId = validateRecordId(recordIdParam);

    const allowedKeys = ["amount", "due_date"];

    validateAllowedKeys(body, allowedKeys);

    const { amount, due_date } = body;

    if (!isValidAmount(amount)) {
      throw createError("Valor da mensalidade inválido.", 400);
    }

    if (!isValidDateString(due_date)) {
      throw createError("Data de vencimento inválida.", 400);
    }

    const existingRecord = await monthlyModel.findRecordById(recordId, userId);

    if (!existingRecord) {
      throw createError("Registro mensal não encontrado.", 404);
    }

    const normalizedAmount = typeof amount === "number" ? amount.toString() : amount.trim();

    const updatedRecord = await monthlyModel.updateRecord(
      recordId,
      {
        student_name: existingRecord.student_name,
        amount: normalizedAmount,
        due_date,
      },
      userId,
    );

    if (!updatedRecord) {
      throw createError("Registro mensal não encontrado.", 404);
    }

    const dueDateFormatted = formatCivilDate(updatedRecord.due_date);

    return {
      ...updatedRecord,
      due_date: dueDateFormatted,
      status: calculateStatus(updatedRecord.is_paid, dueDateFormatted),
    };
  },

  // Atualizar situação do pagamento.
  async updateRecordPayment(recordIdParam, body, userId) {
    validateUserId(userId);

    const recordId = validateRecordId(recordIdParam);

    validateAllowedKeys(body, ["is_paid"]);

    const { is_paid } = body;

    if (typeof is_paid !== "boolean") {
      throw createError("O campo is_paid deve ser booleano.", 400);
    }

    const existingRecord = await monthlyModel.findRecordById(recordId, userId);

    if (!existingRecord) {
      throw createError("Registro mensal não encontrado.", 404);
    }

    const updatedRecord = await monthlyModel.updateRecordPaymentStatus(recordId, is_paid, userId);

    if (!updatedRecord) {
      throw createError("Registro mensal não encontrado.", 404);
    }

    const dueDateFormatted = formatCivilDate(updatedRecord.due_date);

    return {
      ...updatedRecord,
      due_date: dueDateFormatted,
      status: calculateStatus(updatedRecord.is_paid, dueDateFormatted),
    };
  },

  // Excluir mensalidade.
  async deleteRecord(recordIdParam, userId) {
    validateUserId(userId);

    const recordId = validateRecordId(recordIdParam);

    const deletedRecord = await monthlyModel.deleteRecord(recordId, userId);

    if (!deletedRecord) {
      throw createError("Registro mensal não encontrado.", 404);
    }

    return deletedRecord;
  },

  // Copiar registros de um mês para outro.
  async copyMonthRecords(body, userId) {
    validateUserId(userId);

    const allowedKeys = ["source_reference_id", "target_year", "target_month"];

    validateAllowedKeys(body, allowedKeys);

    const { source_reference_id, target_year, target_month } = body;

    if (!isValidId(source_reference_id)) {
      throw createError("ID do mês de referência de origem inválido.", 400);
    }

    if (typeof target_year !== "number" || !Number.isInteger(target_year) || target_year < 2000 || target_year > 2100) {
      throw createError("O campo target_year deve ser um ano válido entre 2000 e 2100.", 400);
    }

    if (typeof target_month !== "number" || !Number.isInteger(target_month) || target_month < 1 || target_month > 12) {
      throw createError("O campo target_month deve ser um mês válido entre 1 e 12.", 400);
    }

    const sourceReferenceId = Number(source_reference_id);

    const sourceMonth = await monthlyModel.findMonthById(sourceReferenceId, userId);

    if (!sourceMonth) {
      throw createError("Mês de referência de origem não encontrado.", 404);
    }

    const existingTargetMonth = await monthlyModel.findMonthByYearAndMonth(target_year, target_month, userId);

    if (existingTargetMonth) {
      throw createError("O mês de referência de destino já existe.", 409);
    }

    const sourceRecords = await monthlyModel.findRecordsByMonthId(sourceReferenceId, userId);

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      let targetMonth;

      try {
        targetMonth = await monthlyModel.createMonthWithClient(
          client,
          {
            year: target_year,
            month: target_month,
          },
          userId,
        );
      } catch (dbError) {
        if (dbError.code === "23505") {
          throw createError("O mês de referência de destino já existe.", 409);
        }

        throw dbError;
      }

      const copiedRecords = [];

      const getLastDayOfMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

      for (const record of sourceRecords) {
        if (!record.due_date) {
          throw createError("Inconsistência de dados: registro de origem possui due_date inválido ou ausente.", 400);
        }

        const originalDateStr = formatCivilDate(record.due_date);

        if (!isValidDateString(originalDateStr)) {
          throw createError("Inconsistência de dados: formato de data de vencimento inválido na origem.", 400);
        }

        const parts = originalDateStr.split("-");
        const originalDueDay = Number(parts[2]);

        const lastDayOfTarget = getLastDayOfMonth(target_year, target_month);

        const adjustedDay = Math.min(originalDueDay, lastDayOfTarget);

        const targetDueDayStr = String(adjustedDay).padStart(2, "0");

        const targetMonthStr = String(target_month).padStart(2, "0");

        const newDueDate = `${target_year}-${targetMonthStr}-${targetDueDayStr}`;

        const newRecord = await monthlyModel.createRecordWithClient(
          client,
          {
            student_id: record.student_id,
            reference_month_id: targetMonth.id,
            student_name: record.student_name,
            amount: record.amount,
            due_date: newDueDate,
          },
          userId,
        );

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

  // Excluir mês e mensalidades pertencentes ao usuário.
  async deleteMonth(monthId, userId) {
    validateUserId(userId);

    const numericMonthId = validateReferenceId(monthId);

    const existingMonth = await monthlyModel.findMonthById(numericMonthId, userId);

    if (!existingMonth) {
      throw createError("Mês de referência não encontrado.", 404);
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const deletedRecords = await monthlyModel.deleteRecordsByReferenceIdWithClient(client, numericMonthId, userId);

      const deletedMonth = await monthlyModel.deleteMonthWithClient(client, numericMonthId, userId);

      if (!deletedMonth) {
        throw createError("Mês de referência não encontrado.", 404);
      }

      await client.query("COMMIT");

      return {
        message: "Mês de referência e mensalidades excluídos com sucesso.",
        deletedMonth,
        deletedRecordsCount: deletedRecords.length,
      };
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Erro crítico ao executar ROLLBACK:", rollbackError);
        }
      }

      throw error;
    } finally {
      client.release();
    }
  },
};
