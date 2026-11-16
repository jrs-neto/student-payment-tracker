import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

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

function validateClaimSecret(providedSecret) {
  const expectedSecret = process.env.LEGACY_CLAIM_SECRET;

  if (!expectedSecret || Buffer.byteLength(expectedSecret, "utf8") < 32) {
    throw new Error("LEGACY_CLAIM_SECRET não configurado corretamente.");
  }

  if (typeof providedSecret !== "string") {
    throw createSafeError("Não foi possível validar a reivindicação.", 403);
  }

  const expectedBuffer = Buffer.from(expectedSecret, "utf8");
  const providedBuffer = Buffer.from(providedSecret, "utf8");

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw createSafeError("Não foi possível validar a reivindicação.", 403);
  }
}

export const authService = {
  async register({ name, email, password }) {
    validateRegistration({ name, email, password });

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

    return { user, token };
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

  async claimLegacy({ name, email, password, claimSecret }) {
    validateRegistration({ name, email, password });

    validateClaimSecret(claimSecret);

    const jwtConfig = getJwtOptions();

    const normalizedName = name.trim();
    const normalizedEmail = normalizeEmail(email);

    if (normalizedEmail === "legado@studenttracker.local") {
      throw createSafeError("Informe um endereço de e-mail válido para sua conta.", 400);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    let user;

    try {
      user = await userModel.claimLegacy({
        name: normalizedName,
        email: normalizedEmail,
        passwordHash,
      });
    } catch (error) {
      if (error.code === "23505") {
        throw createSafeError("Este e-mail já está associado a outra conta.", 409);
      }

      throw error;
    }

    if (!user) {
      throw createSafeError("A conta legada não está disponível para reivindicação.", 409);
    }

    const token = generateToken(user, jwtConfig);

    return {
      user,
      token,
    };
  },
};
