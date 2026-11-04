export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    error: {
      status: 404,
      message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
    },
  });
};
