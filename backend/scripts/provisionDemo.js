import "dotenv/config";
import bcrypt from "bcryptjs";
import pool from "../src/config/database.js";

const email = process.env.DEMO_ACCOUNT_EMAIL?.trim().toLowerCase();
const password = process.env.DEMO_ACCOUNT_PASSWORD;

if (process.env.DEMO_PROVISION_CONFIRM !== "YES") {
  throw new Error("Defina DEMO_PROVISION_CONFIRM=YES para confirmar o provisionamento controlado.");
}
if (!email || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("DEMO_ACCOUNT_EMAIL inválido.");
if (!password || Buffer.byteLength(password, "utf8") < 12 || Buffer.byteLength(password, "utf8") > 72) {
  throw new Error("DEMO_ACCOUNT_PASSWORD deve ter entre 12 e 72 bytes.");
}

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const existing = await client.query("SELECT id FROM users WHERE email = $1 FOR UPDATE", [email]);
  if (existing.rowCount) throw new Error("Este e-mail já existe. O provisionamento não altera contas existentes.");

  const passwordHash = await bcrypt.hash(password, 12);
  const userResult = await client.query(
    `INSERT INTO users (name, email, password_hash, is_demo)
     VALUES ('Conta de Demonstração', $1, $2, TRUE)
     RETURNING id`,
    [email, passwordHash],
  );
  const userId = userResult.rows[0].id;

  const students = [
    ["Ana Lima", "Marina Lima"], ["Bruno Costa", "Rafael Costa"],
    ["Caio Mendes", "Paula Mendes"], ["Duda Rocha", "Sofia Rocha"],
    ["Enzo Martins", "Lúcia Martins"], ["Flora Alves", "Pedro Alves"],
    ["Gabi Nunes", "Clara Nunes"], ["Hugo Freitas", "Igor Freitas"],
  ];
  const studentIds = [];
  for (let i = 0; i < students.length; i += 1) {
    const [name, guardian] = students[i];
    const result = await client.query(
      `INSERT INTO students (name, guardian_name, guardian_email, is_active, user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, guardian, `responsavel${i + 1}@example.test`, i !== 7, userId],
    );
    studentIds.push(result.rows[0].id);
  }

const referenceParts = new Intl.DateTimeFormat("en", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "numeric",
}).formatToParts(new Date());
const currentYear = Number(referenceParts.find((part) => part.type === "year").value);
const currentMonth = Number(referenceParts.find((part) => part.type === "month").value);
  for (const offset of [-1, 0, 1]) {
    const monthDate = new Date(Date.UTC(currentYear, currentMonth - 1 + offset, 1));
    const year = monthDate.getUTCFullYear();
    const month = monthDate.getUTCMonth() + 1;
    const monthResult = await client.query(
      `INSERT INTO reference_months (year, month, user_id) VALUES ($1, $2, $3) RETURNING id`,
      [year, month, userId],
    );
    const referenceId = monthResult.rows[0].id;
    for (let i = 0; i < studentIds.length; i += 1) {
      const day = Math.min(10 + (i % 15), 28);
      const dueDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      await client.query(
        `INSERT INTO monthly_records
           (student_id, reference_month_id, student_name, amount, due_date, is_paid, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [studentIds[i], referenceId, students[i][0], (180 + 20 * i).toFixed(2), dueDate, offset !== 0 && i % 3 === 0, userId],
      );
    }
  }

  await client.query("COMMIT");
  console.log(`Conta de demonstração provisionada: ${email} (id ${userId}); 8 alunos, 3 meses e 24 mensalidades fictícias.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
