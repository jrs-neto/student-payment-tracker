import jwt from "jsonwebtoken";
import { userModel } from "../models/userModel.js";

function unauthorized(res) {
  return res.status(401).json({
    error: {
      status: 401,
      code: "AUTH_REQUIRED",
      message: "Autenticação necessária ou token inválido.",
    },
  });
}

export async function authMiddleware(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (typeof authorization !== "string") {
      return unauthorized(res);
    }

    const match = authorization.match(/^Bearer ([^\s]+)$/i);

    if (!match) {
      return unauthorized(res);
    }

    const token = match[1];
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new Error("JWT_SECRET não configurado corretamente.");
    }

    let decoded;

    try {
      decoded = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        issuer: "student-payment-tracker",
        audience: "student-payment-tracker-api",
      });
    } catch {
      return unauthorized(res);
    }

    if (!decoded || typeof decoded !== "object" || !decoded.sub || !/^[1-9]\d*$/.test(decoded.sub)) {
      return unauthorized(res);
    }

    const user = await userModel.findById(Number(decoded.sub));

    if (!user) {
      return unauthorized(res);
    }

    if (user.is_demo === true && process.env.DEMO_ENABLED !== "true") {
      return unauthorized(res);
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      isDemo: user.is_demo === true,
      googleLinked: Boolean(user.google_id),
    };

    next();
  } catch (error) {
    next(error);
  }
}
