export function readOnlyDemoMiddleware(req, res, next) {
  if (!req.user?.isDemo) return next();

  return res.status(403).json({
    error: {
      status: 403,
      message: "A conta de demonstração está em modo somente leitura.",
    },
  });
}
