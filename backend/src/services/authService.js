import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";

import pool from "../config/database.js";
import { userModel } from "../models/userModel.js";
import { monthlyModel } from "../models/monthlyModel.js";

const SALT_ROUNDS = 12;

const JWT_ISSUER = "student-payment-tracker";
const JWT_AUDIENCE = "student-payment-tracker-api";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

const googleOAuthClient = new OAuth2Client();

function createSafeError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.isSafe = true;
  if (code) error.code = code;

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

function getGoogleClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID não configurado.");
  }

  return clientId;
}

function validateGoogleIdTokenInput(idToken) {
  if (typeof idToken !== "string" || !idToken || idToken.length > 10000) {
    throw createSafeError("Token Google inválido.", 400);
  }
}

async function verifyGoogleIdToken(idToken, clientId) {
  let payload;

  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken,
      audience: clientId,
    });

    payload = ticket.getPayload();
  } catch {
    throw createSafeError("Não foi possível validar sua autenticação Google.", 401);
  }

  if (
    !payload ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true
  ) {
    throw createSafeError("A conta Google não forneceu uma identidade válida ou um e-mail verificado.", 401);
  }

  const normalizedEmail = normalizeEmail(payload.email);

  if (normalizedEmail.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw createSafeError("O endereço de e-mail da conta Google é inválido.", 401);
  }

  return {
    googleId: payload.sub,
    email: normalizedEmail,
    name:
      typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim().slice(0, 150)
        : normalizedEmail.split("@")[0].slice(0, 150),
  };
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

function getCurrentReferenceMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Não foi possível determinar o mês de referência atual.");
  }

  return { year, month };
}

export const authService = {
  async demoLogin() {
    if (process.env.DEMO_ENABLED !== "true") {
      throw createSafeError("A demonstração não está disponível.", 404);
    }

    const configuredEmail = process.env.DEMO_ACCOUNT_EMAIL;

    if (!configuredEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail)) {
      throw new Error("DEMO_ACCOUNT_EMAIL não configurado corretamente.");
    }

    const jwtConfig = getJwtOptions();

    const user = await userModel.findByEmail(normalizeEmail(configuredEmail));

    if (!user || user.is_demo !== true) {
      throw new Error("A conta de demonstração não foi provisionada corretamente.");
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      isDemo: true,
    };

    return {
      user: safeUser,
      token: generateToken(user, jwtConfig),
    };
  },

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

    const { year, month } = getCurrentReferenceMonth();

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

      const user = await userModel.create(
        {
          name: normalizedName,
          email: normalizedEmail,
          passwordHash,
        },
        client,
      );

      await monthlyModel.createMonthWithClient(client, { year, month }, user.id);

      await client.query("COMMIT");

      const token = generateToken(user, jwtConfig);

      return {
        user,
        token,
      };
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Erro ao desfazer transação de cadastro:", rollbackError.message);
        }
      }

      if (error.code === "23505") {
        throw createSafeError("Não foi possível cadastrar esta conta.", 409);
      }

      throw error;
    } finally {
      client?.release();
    }
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

  async googleLogin({ idToken }) {
    const clientId = getGoogleClientId();
    validateGoogleIdTokenInput(idToken);

    const jwtConfig = getJwtOptions();
    const googleIdentity = await verifyGoogleIdToken(idToken, clientId);
    const { googleId, email: normalizedEmail } = googleIdentity;
    const normalizedName = googleIdentity.name;

    // Primeiro, procura uma conta já vinculada a esta identidade Google.
    const googleUser = await userModel.findByGoogleId(googleId);

    if (googleUser) {
      const { password_hash, ...safeUser } = googleUser;

      return {
        user: safeUser,
        token: generateToken(googleUser, jwtConfig),
      };
    }

    // Não associa automaticamente contas tradicionais pelo endereço de e-mail.
    const existingEmailUser = await userModel.findByEmail(normalizedEmail);

    if (existingEmailUser) {
      throw createSafeError(
        "Este e-mail já possui uma conta. Entre com e-mail e senha para acessar sua conta existente.",
        409,
      );
    }

    const { year, month } = getCurrentReferenceMonth();

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

      const user = await userModel.createGoogleAccount(
        {
          name: normalizedName,
          email: normalizedEmail,
          googleId,
        },
        client,
      );

      await monthlyModel.createMonthWithClient(client, { year, month }, user.id);

      await client.query("COMMIT");

      const { password_hash, ...safeUser } = user;

      return {
        user: safeUser,
        token: generateToken(user, jwtConfig),
      };
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Erro ao desfazer transação de cadastro Google:", rollbackError.message);
        }
      }

      if (error.code === "23505") {
        // Outra requisição pode ter criado a mesma conta simultaneamente.
        const concurrentUser = await userModel.findByGoogleId(googleId);

        if (concurrentUser) {
          return {
            user: concurrentUser,
            token: generateToken(concurrentUser, jwtConfig),
          };
        }

        throw createSafeError("Não foi possível criar esta conta. Verifique se o e-mail já está em uso.", 409);
      }

      throw error;
    } finally {
      client?.release();
    }
  },

  async linkGoogle({ userId, password, idToken }) {
    const clientId = getGoogleClientId();
    validateGoogleIdTokenInput(idToken);

    const account = await userModel.findByIdForGoogleLink(userId);

    if (!account) {
      throw createSafeError("A conta autenticada não está disponível.", 401);
    }

    if (account.is_demo === true) {
      throw createSafeError("Contas de demonstração não podem vincular uma conta Google.", 403);
    }

    if (!account.password_hash) {
      throw createSafeError("Esta operação exige uma conta tradicional com senha.", 409);
    }

    validateLogin({ email: account.email, password });

    const googleIdentity = await verifyGoogleIdToken(idToken, clientId);

    if (googleIdentity.email !== normalizeEmail(account.email)) {
      throw createSafeError("O e-mail verificado da conta Google deve corresponder ao e-mail desta conta.", 409);
    }

    const passwordMatches = await bcrypt.compare(password, account.password_hash);

    if (!passwordMatches) {
      throw createSafeError("A senha atual está incorreta.", 401, "INVALID_PASSWORD");
    }

    if (account.google_id === googleIdentity.googleId) {
      const { password_hash, ...safeUser } = account;

      return {
        user: safeUser,
        alreadyLinked: true,
      };
    }

    if (account.google_id) {
      throw createSafeError("Esta conta já está vinculada a outra identidade Google.", 409);
    }

    try {
      const updatedUser = await userModel.linkGoogleId(userId, googleIdentity.googleId);

      if (updatedUser) {
        return {
          user: updatedUser,
          alreadyLinked: false,
        };
      }

      // Outra tentativa pode ter vinculado a identidade enquanto esta aguardava.
      const currentAccount = await userModel.findByIdForGoogleLink(userId);

      if (!currentAccount) {
        throw createSafeError("A conta autenticada não está disponível.", 401);
      }

      if (currentAccount.google_id === googleIdentity.googleId) {
        const { password_hash, ...safeUser } = currentAccount;

        return {
          user: safeUser,
          alreadyLinked: true,
        };
      }

      throw createSafeError("Esta conta já está vinculada a outra identidade Google.", 409);
    } catch (error) {
      if (error.code === "23505") {
        throw createSafeError("Esta identidade Google já está vinculada a outra conta.", 409);
      }

      throw error;
    }
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
