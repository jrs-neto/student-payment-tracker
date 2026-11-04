export const errorHandler = (err, req, res, next) => {
  // Tratamento específico para JSON inválido enviado pelo cliente (SyntaxError do body-parser)
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      error: {
        status: 400,
        message: "JSON inválido enviado no corpo da requisição.",
      },
    });
  }

  // Extrai o código de status bruto do erro
  let statusCode = err.status || err.statusCode || 500;

  // Validação estrita: garante que o código HTTP seja um número válido entre 400 e 599.
  // Caso contrário, normaliza para 500 (Erro Interno do Servidor).
  if (typeof statusCode !== "number" || statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  // Resposta simplificada e genérica para todos os demais erros
  res.status(statusCode).json({
    error: {
      status: statusCode,
      message: "Ocorreu um erro ao processar a requisição.",
    },
  });
};
