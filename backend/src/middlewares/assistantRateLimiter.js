import rateLimit from "express-rate-limit";

export const assistantRateLimiter = rateLimit({
  windowMs: 60 * 1000,

  limit: 10,

  keyGenerator: (req) => `user:${req.user.id}`,

  standardHeaders: true,

  legacyHeaders: false,

  handler: (req, res) => {
    return res.status(429).json({
      error: {
        status: 429,
        message: "Você atingiu o limite de mensagens. Aguarde um minuto antes de tentar novamente.",
      },
    });
  },
});
