import { studentModel } from "../models/studentModel.js";

// Utilitário básico e seguro para validação de formato de e-mail
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validador estrito: garante que o payload seja um objeto JSON válido (rejeita null, arrays e primitivos)
const validateAllowedKeys = (payload, allowedKeys) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  const keys = Object.keys(payload);
  if (keys.length === 0) return false;
  return keys.every((key) => allowedKeys.includes(key));
};

export const studentService = {
  async createStudent(body) {
    const allowedKeys = ["name", "guardian_name", "guardian_email"];
    if (!validateAllowedKeys(body, allowedKeys)) {
      const error = new Error(
        "Payload inválido. O corpo da requisição deve ser um objeto JSON contendo estritamente e apenas os campos name, guardian_name e guardian_email.",
      );
      error.status = 400;
      throw error;
    }

    const { name, guardian_name, guardian_email } = body;

    // Validação obrigatória do nome do aluno
    if (!name || typeof name !== "string" || name.trim() === "" || name.length > 150) {
      const error = new Error(
        "O campo name é obrigatório, deve ser um texto válido e possuir no máximo 150 caracteres.",
      );
      error.status = 400;
      throw error;
    }

    // Tratamento de guardian_name (opcional: converte vazio ou espaços em null)
    let processedGuardianName = null;
    if (guardian_name !== undefined && guardian_name !== null) {
      if (typeof guardian_name !== "string" || guardian_name.length > 150) {
        const error = new Error("O campo guardian_name deve ser um texto válido e possuir no máximo 150 caracteres.");
        error.status = 400;
        throw error;
      }
      const trimmed = guardian_name.trim();
      processedGuardianName = trimmed === "" ? null : trimmed;
    }

    // Tratamento de guardian_email (opcional: valida formato apenas se preenchido)
    let processedGuardianEmail = null;
    if (guardian_email !== undefined && guardian_email !== null) {
      if (typeof guardian_email !== "string" || guardian_email.length > 150) {
        const error = new Error("O campo guardian_email deve ser um texto válido e possuir no máximo 150 caracteres.");
        error.status = 400;
        throw error;
      }
      const trimmed = guardian_email.trim();
      if (trimmed !== "") {
        if (!isValidEmail(trimmed)) {
          const error = new Error("O formato do e-mail do responsável (guardian_email) é inválido.");
          error.status = 400;
          throw error;
        }
        processedGuardianEmail = trimmed.toLowerCase();
      }
    }

    return await studentModel.create({
      name: name.trim(),
      guardian_name: processedGuardianName,
      guardian_email: processedGuardianEmail,
    });
  },

  async listStudents(statusQuery) {
    let statusFilter = null;

    if (statusQuery !== undefined) {
      if (statusQuery === "active") {
        statusFilter = "active";
      } else if (statusQuery === "inactive") {
        statusFilter = "inactive";
      } else {
        const error = new Error('Parâmetro de consulta "status" inválido. Utilize "active" ou "inactive".');
        error.status = 400;
        throw error;
      }
    }

    return await studentModel.findAll(statusFilter);
  },

  async getStudentById(idParam) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      const error = new Error("ID de aluno inválido.");
      error.status = 400;
      throw error;
    }

    const student = await studentModel.findById(id);
    if (!student) {
      const error = new Error("Aluno não encontrado.");
      error.status = 404;
      throw error;
    }

    return student;
  },

  async updateStudent(idParam, body) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      const error = new Error("ID de aluno inválido.");
      error.status = 400;
      throw error;
    }

    const allowedKeys = ["name", "guardian_name", "guardian_email"];
    if (!validateAllowedKeys(body, allowedKeys)) {
      const error = new Error(
        "Payload inválido. A substituição exige estritamente e apenas um objeto JSON contendo os campos name, guardian_name e guardian_email.",
      );
      error.status = 400;
      throw error;
    }

    const { name, guardian_name, guardian_email } = body;

    // Validação obrigatória do nome do aluno
    if (!name || typeof name !== "string" || name.trim() === "" || name.length > 150) {
      const error = new Error("O campo name é obrigatório para a atualização.");
      error.status = 400;
      throw error;
    }

    // Tratamento opcional para guardian_name na atualização
    let processedGuardianName = null;
    if (guardian_name !== undefined && guardian_name !== null) {
      if (typeof guardian_name !== "string" || guardian_name.length > 150) {
        const error = new Error("O campo guardian_name deve ser um texto válido e possuir no máximo 150 caracteres.");
        error.status = 400;
        throw error;
      }
      const trimmed = guardian_name.trim();
      processedGuardianName = trimmed === "" ? null : trimmed;
    }

    // Tratamento opcional para guardian_email na atualização
    let processedGuardianEmail = null;
    if (guardian_email !== undefined && guardian_email !== null) {
      if (typeof guardian_email !== "string" || guardian_email.length > 150) {
        const error = new Error("O campo guardian_email deve ser um texto válido e possuir no máximo 150 caracteres.");
        error.status = 400;
        throw error;
      }
      const trimmed = guardian_email.trim();
      if (trimmed !== "") {
        if (!isValidEmail(trimmed)) {
          const error = new Error("O formato do e-mail do responsável (guardian_email) é inválido.");
          error.status = 400;
          throw error;
        }
        processedGuardianEmail = trimmed.toLowerCase();
      }
    }

    const updatedStudent = await studentModel.update(id, {
      name: name.trim(),
      guardian_name: processedGuardianName,
      guardian_email: processedGuardianEmail,
    });

    if (!updatedStudent) {
      const error = new Error("Aluno não encontrado para atualização.");
      error.status = 404;
      throw error;
    }

    return updatedStudent;
  },

  async updateStudentStatus(idParam, body) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      const error = new Error("ID de aluno inválido.");
      error.status = 400;
      throw error;
    }

    const allowedKeys = ["is_active"];
    if (!validateAllowedKeys(body, allowedKeys)) {
      const error = new Error(
        "Payload inválido. A alteração de status exige estritamente e apenas um objeto JSON contendo o campo is_active.",
      );
      error.status = 400;
      throw error;
    }

    const { is_active } = body;
    if (typeof is_active !== "boolean") {
      const error = new Error("O campo is_active deve ser estritamente um valor booleano (true ou false).");
      error.status = 400;
      throw error;
    }

    const updatedStudent = await studentModel.updateStatus(id, is_active);
    if (!updatedStudent) {
      const error = new Error("Aluno não encontrado para alteração de status.");
      error.status = 404;
      throw error;
    }

    return updatedStudent;
  },
};
