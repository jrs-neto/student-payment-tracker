import "dotenv/config";
import pkg from "pg";

const { Pool } = pkg;

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === "true" ? true : false,
    };

const pool = new Pool(poolConfig);

// Tratamento de erros inesperados em clientes inativos do pool para evitar encerramento do processo
pool.on("error", (err) => {
  console.error("Erro inesperado em cliente inativo do pool PostgreSQL:", err);
});

// Teste rápido de conexão ao iniciar
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("Erro ao conectar ao PostgreSQL:", err.message);
  } else {
    console.log("Conexão com o PostgreSQL estabelecida com sucesso em:", res.rows[0].now);
  }
});

export default pool;
