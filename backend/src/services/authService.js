import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { userModel } from "../models/userModel.js";

const SALT_ROUNDS = 12;

const JWT_ISSUER = "student-payment-tracker";
const JWT_AUDIENCE = "student-payment-tracker-api";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

function createSafeError(message, status) {
  const error = new Error(message);
  error.status = status;
  error.isSafe = true;

  return error;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// Valida a configuração do JWT antes de consultar ou alterar o banco.
function getJwtOptions() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET não configurado corretamente. Utilize uma chave com pelo menos 32 caracteres.");
  }

  const options = {
    expiresIn: JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: "HS256",
  };

  // Valida também o prazo de expiração antes de qualquer cadastro.
  // Isso evita criar uma conta e depois falhar ao gerar seu token.
  jwt.sign({}, secret, {
    ...options,
    subject: "1",
  });

  return { secret, options };
}

function generateToken(user, jwtConfig) {
  return jwt.sign({}, jwtConfig.secret, {
    ...jwtConfig.options,
    subject: String(user.id),
  });
}

function validateRegistration({ name, email, password }) {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 150) {
    throw createSafeError("Nome inválido.", 400);
  }

  if (
    typeof email !== "string" ||
    !email.trim() ||
    email.trim().length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    throw createSafeError("E-mail inválido.", 400);
  }

  if (
    typeof password !== "string" ||
    Buffer.byteLength(password, "utf8") < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw createSafeError("A senha deve possuir pelo menos 8 caracteres e respeitar o limite de 72 bytes.", 400);
  }
}

function validateLogin({ email, password }) {
  if (
    typeof email !== "string" ||
    !email.trim() ||
    email.trim().length > 150 ||
    typeof password !== "string" ||
    !password ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw createSafeError("E-mail ou senha inválidos.", 400);
  }
}

export const authService = {
  async register({ name, email, password }) {
    validateRegistration({ name, email, password });

    // Valida o JWT antes de qualquer alteração no banco.
    const jwtConfig = getJwtOptions();

    const normalizedName = name.trim();
    const normalizedEmail = normalizeEmail(email);

    const existingUser = await userModel.findByEmail(normalizedEmail);

    if (existingUser) {
      throw createSafeError("Não foi possível cadastrar esta conta.", 409);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    let user;

    try {
      user = await userModel.create({
        name: normalizedName,
        email: normalizedEmail,
        passwordHash,
      });
    } catch (error) {
      if (error.code === "23505") {
        throw createSafeError("Não foi possível cadastrar esta conta.", 409);
      }

      throw error;
    }

    const token = generateToken(user, jwtConfig);

    return {
      user,
      token,
    };
  },

  async login({ email, password }) {
    validateLogin({ email, password });

    const jwtConfig = getJwtOptions();

    const normalizedEmail = normalizeEmail(email);

    const user = await userModel.findByEmail(normalizedEmail);

    if (!user || !user.password_hash) {
      throw createSafeError("E-mail ou senha incorretos.", 401);
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      throw createSafeError("E-mail ou senha incorretos.", 401);
    }

    const token = generateToken(user, jwtConfig);

    const { password_hash, ...safeUser } = user;

    return {
      user: safeUser,
      token,
    };
  },
};
