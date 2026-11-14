import express from "express";
import cors from "cors";

import "./config/database.js";

import authRoutes from "./routes/authRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import monthlyRoutes from "./routes/monthlyRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";

import { notFoundHandler } from "./middlewares/notFoundHandler.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5173",
  ...(process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origem não permitida pelo CORS."));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "100kb" }));

// Verificação da API
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Student Payment Tracker API está funcionando.",
  });
});

// Rotas de autenticação
app.use("/api/auth", authRoutes);

// Rotas da aplicação
app.use("/api/students", studentRoutes);
app.use("/api", monthlyRoutes);
app.use("/api/assistant", assistantRoutes);

// Tratamento de erros
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
