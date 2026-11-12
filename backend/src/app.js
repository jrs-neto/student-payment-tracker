import express from "express";
import cors from "cors";
import "./config/database.js";
import studentRoutes from "./routes/studentRoutes.js";
import monthlyRoutes from "./routes/monthlyRoutes.js";
import { notFoundHandler } from "./middlewares/notFoundHandler.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import assistantRoutes from "./routes/assistantRoutes.js";

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = ["http://localhost:5173"];

if (process.env.FRONTEND_URL) {
  const envOrigins = process.env.FRONTEND_URL.split(",")
    .map((url) => url.trim().replace(/\/$/, ""))
    .filter(Boolean);
  allowedOrigins.push(...envOrigins);
}

// Configuração do CORS para origens autorizadas
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Middleware para interpretar JSON
app.use(express.json());

// Rota raiz temporária
app.get("/", (req, res) => {
  res.json({ message: "API do Sistema de Mensalidades rodando com sucesso!" });
});

// Registro das rotas de alunos, mensalidades e assistente
app.use("/api/students", studentRoutes);
app.use("/api", monthlyRoutes);
app.use("/api/assistant", assistantRoutes);

// Middleware para rotas inexistentes (404)
app.use(notFoundHandler);

// Middleware centralizado de tratamento de erros
app.use(errorHandler);

export default app;
