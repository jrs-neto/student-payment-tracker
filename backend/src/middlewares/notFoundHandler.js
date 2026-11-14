export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    error: {
      status: 404,
      message: "Rota não encontrada.",
    },
  });
};
