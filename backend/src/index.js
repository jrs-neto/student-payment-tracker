import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Mantém conexões Keep-Alive vivas por 65 s (> tempo de reutilização de socket do proxy do Vite),
// evitando ECONNRESET por socket reutilizado após o backend encerrar a conexão ociosa.
// headersTimeout deve ser ligeiramente maior que keepAliveTimeout.
server.keepAliveTimeout = 65_000;
server.headersTimeout   = 66_000;
