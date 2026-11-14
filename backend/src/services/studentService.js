import { studentModel } from "../models/studentModel.js";

// Validação do ID do usuário autenticado
const validateUserId = (userId) => {
  if (!Number.isInteger(userId) || userId <= 0) {
    const error = new Error("Usuário autenticado inválido.");
    error.status = 401;
    throw error;
  }
};

// Validação do formato de e-mail
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validação dos campos permitidos
const validateAllowedKeys = (payload, allowedKeys) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const keys = Object.keys(payload);

  if (keys.length === 0) return false;

  return keys.every((key) => allowedKeys.includes(key));
};

export const studentService = {
  async createStudent(body, userId) {
    validateUserId(userId);

    const allowedKeys = ["name", "guardian_name", "guardian_email"];

    if (!validateAllowedKeys(body, allowedKeys)) {
      const error = new Error(
        "Payload inválido. O corpo da requisição deve conter apenas name, guardian_name e guardian_email.",
      );
      error.status = 400;
      throw error;
    }

    const { name, guardian_name, guardian_email } = body;

    if (!name || typeof name !== "string" || name.trim() === "" || name.length > 150) {
      const error = new Error("O campo name é obrigatório e deve possuir no máximo 150 caracteres.");
      error.status = 400;
      throw error;
    }

    let processedGuardianName = null;

    if (guardian_name !== undefined && guardian_name !== null) {
      if (typeof guardian_name !== "string" || guardian_name.length > 150) {
        const error = new Error("O campo guardian_name deve possuir no máximo 150 caracteres.");
        error.status = 400;
        throw error;
      }

      const trimmed = guardian_name.trim();
      processedGuardianName = trimmed === "" ? null : trimmed;
    }

    let processedGuardianEmail = null;

    if (guardian_email !== undefined && guardian_email !== null) {
      if (typeof guardian_email !== "string" || guardian_email.length > 150) {
        const error = new Error("O campo guardian_email deve possuir no máximo 150 caracteres.");
        error.status = 400;
        throw error;
      }

      const trimmed = guardian_email.trim();

      if (trimmed !== "") {
        if (!isValidEmail(trimmed)) {
          const error = new Error("O formato do e-mail do responsável é inválido.");
          error.status = 400;
          throw error;
        }

        processedGuardianEmail = trimmed.toLowerCase();
      }
    }

    return studentModel.create(
      {
        name: name.trim(),
        guardian_name: processedGuardianName,
        guardian_email: processedGuardianEmail,
      },
      userId,
    );
  },

  async listStudents(statusQuery, userId) {
    validateUserId(userId);

    let statusFilter = null;

    if (statusQuery !== undefined) {
      if (statusQuery === "active") {
        statusFilter = "active";
      } else if (statusQuery === "inactive") {
        statusFilter = "inactive";
      } else {
        const error = new Error('Parâmetro "status" inválido. Utilize "active" ou "inactive".');
        error.status = 400;
        throw error;
      }
    }

    return studentModel.findAll(statusFilter, userId);
  },

  async getStudentById(idParam, userId) {
    validateUserId(userId);

    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      const error = new Error("ID de aluno inválido.");
      error.status = 400;
      throw error;
    }

    const student = await studentModel.findById(id, userId);

    if (!student) {
      const error = new Error("Aluno não encontrado.");
      error.status = 404;
      throw error;
    }

    return student;
  },

  async updateStudent(idParam, body, userId) {
    validateUserId(userId);

    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      const error = new Error("ID de aluno inválido.");
      error.status = 400;
      throw error;
    }

    const allowedKeys = ["name", "guardian_name", "guardian_email"];

    if (!validateAllowedKeys(body, allowedKeys)) {
      const error = new Error("Payload inválido. Envie apenas name, guardian_name e guardian_email.");
      error.status = 400;
      throw error;
    }

    const { name, guardian_name, guardian_email } = body;

    if (!name || typeof name !== "string" || name.trim() === "" || name.length > 150) {
      const error = new Error("O campo name é obrigatório para a atualização.");
      error.status = 400;
      throw error;
    }

    let processedGuardianName = null;

    if (guardian_name !== undefined && guardian_name !== null) {
      if (typeof guardian_name !== "string" || guardian_name.length > 150) {
        const error = new Error("O campo guardian_name deve possuir no máximo 150 caracteres.");
        error.status = 400;
        throw error;
      }

      const trimmed = guardian_name.trim();
      processedGuardianName = trimmed === "" ? null : trimmed;
    }

    let processedGuardianEmail = null;

    if (guardian_email !== undefined && guardian_email !== null) {
      if (typeof guardian_email !== "string" || guardian_email.length > 150) {
        const error = new Error("O campo guardian_email deve possuir no máximo 150 caracteres.");
        error.status = 400;
        throw error;
      }

      const trimmed = guardian_email.trim();

      if (trimmed !== "") {
        if (!isValidEmail(trimmed)) {
          const error = new Error("O formato do e-mail do responsável é inválido.");
          error.status = 400;
          throw error;
        }

        processedGuardianEmail = trimmed.toLowerCase();
      }
    }

    const updatedStudent = await studentModel.update(
      id,
      {
        name: name.trim(),
        guardian_name: processedGuardianName,
        guardian_email: processedGuardianEmail,
      },
      userId,
    );

    if (!updatedStudent) {
      const error = new Error("Aluno não encontrado para atualização.");
      error.status = 404;
      throw error;
    }

    return updatedStudent;
  },

  async updateStudentStatus(idParam, body, userId) {
    validateUserId(userId);

    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      const error = new Error("ID de aluno inválido.");
      error.status = 400;
      throw error;
    }

    const allowedKeys = ["is_active"];

    if (!validateAllowedKeys(body, allowedKeys)) {
      const error = new Error("Payload inválido. Envie apenas o campo is_active.");
      error.status = 400;
      throw error;
    }

    const { is_active } = body;

    if (typeof is_active !== "boolean") {
      const error = new Error("O campo is_active deve ser um valor booleano.");
      error.status = 400;
      throw error;
    }

    const updatedStudent = await studentModel.updateStatus(id, is_active, userId);

    if (!updatedStudent) {
      const error = new Error("Aluno não encontrado para alteração de status.");
      error.status = 404;
      throw error;
    }

    return updatedStudent;
  },
};
