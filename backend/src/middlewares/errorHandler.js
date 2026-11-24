export const errorHandler = (err, req, res, next) => {
  // Tratamento específico para JSON inválido enviado pelo cliente
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      error: {
        status: 400,
        message: "JSON inválido enviado no corpo da requisição.",
      },
    });
  }

  // Extrai o código de status do erro
  let statusCode = Number(err.status ?? err.statusCode ?? err.response?.status);

  // Garante um código HTTP válido entre 400 e 599
  if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  // Utiliza mensagens controladas para erros conhecidos
  const safeMessages = {
    429: "Você atingiu o limite de requisições. Aguarde antes de tentar novamente.",
    502: "Não foi possível estabelecer comunicação com o serviço de IA.",
    503: "O serviço de IA está temporariamente indisponível. Tente novamente em instantes.",
    504: "O serviço de IA demorou demais para responder. Tente novamente.",
  };

  let message;
  const errorCode =
    err.isSafe === true && err.code === "INVALID_PASSWORD"
      ? err.code
      : undefined;

  // Erros 4xx são expostos somente se estiverem explicitamente marcados como seguros
  if (
    statusCode >= 400 &&
    statusCode < 500 &&
    err.isSafe === true &&
    typeof err.message === "string" &&
    err.message.trim()
  ) {
    message = err.message.trim();
  } else {
    message = safeMessages[statusCode] || "Ocorreu um erro ao processar a requisição.";
  }

  // Registra erros internos (5xx) no console para depuração, sem expor dados sensíveis
  if (statusCode >= 500) {
    console.error(`[ERRO INTERNO ${statusCode}] ${req.method} ${req.originalUrl || req.url}:`, {
      message: err.message,
      stack: err.stack,
    });
  }

  return res.status(statusCode).json({
    error: {
      status: statusCode,
      message,
      ...(errorCode ? { code: errorCode } : {}),
    },
  });
};
