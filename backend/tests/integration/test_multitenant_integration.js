import jwt from "jsonwebtoken";
import pool from "../../src/config/database.js";
import { executeStudentTool } from "../../src/ai/tools/studentTools.js";
import { executePaymentTool } from "../../src/ai/tools/paymentTools.js";

const BASE_URL = "http://127.0.0.1:3000";

// Identificadores esperados da branch Neon staging-auth
const EXPECTED_NEON_DB = "neondb";
const EXPECTED_NEON_ENDPOINT = "ep-little-frog-b6nom808";
const EXPECTED_NEON_BRANCH_ID = "br-wandering-tree-b6wjprx2";

// Cores e formatação para o console
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

let passedCount = 0;
let failedCount = 0;
const failures = [];

// Rastreamento estrito de entidades criadas pela suíte para limpeza segura
const createdMonthlyRecordIds = [];
const createdReferenceMonthIds = [];
const createdStudentIds = [];
const createdUserIds = [];

function logSection(title) {
  console.log(
    `\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`,
  );
  console.log(`${colors.bold}${colors.cyan}  ${title}${colors.reset}`);
  console.log(
    `${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`,
  );
}

function assert(condition, testId, description, details = "") {
  if (condition) {
    passedCount++;
    console.log(`  ${colors.green}[PASS]${colors.reset} ${colors.bold}${testId}:${colors.reset} ${description}`);
  } else {
    failedCount++;
    const message = `[FAIL] ${testId}: ${description} ${details ? "- " + details : ""}`;
    failures.push(message);
    console.log(`  ${colors.red}[FAIL]${colors.reset} ${colors.bold}${testId}:${colors.reset} ${description}`);
    if (details) {
      console.log(`         ${colors.red}↳ Detalhe: ${details}${colors.reset}`);
    }
  }
}

/**
 * Cliente HTTP com controle de timeout e cabeçalho de simulação de IP.
 * Se o tempo limite for excedido, retorna status 408 com timedOut: true.
 */
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // Se não foi especificado um X-Forwarded-For, utiliza um IP de teste padrão para isolar o rate limiter
  if (!headers["X-Forwarded-For"] && !headers["x-forwarded-for"]) {
    headers["X-Forwarded-For"] = options.simulatedIp || "10.10.10.1";
  }

  // Timeout padrão: 15 segundos para rotas convencionais, 30 segundos para o assistente Gemini
  const timeoutMs = options.timeoutMs || (path.startsWith("/api/assistant") ? 30000 : 15000);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return {
      status: response.status,
      headers: response.headers,
      data,
      timedOut: false,
    };
  } catch (err) {
    if (err.name === "AbortError" || controller.signal.aborted) {
      return {
        status: 408,
        headers: new Headers(),
        data: {
          error: {
            status: 408,
            message: `Requisição HTTP para ${path} excedeu o tempo limite de ${timeoutMs}ms.`,
          },
        },
        timedOut: true,
      };
    }

    // Diagnóstico detalhado de falhas de comunicação HTTP
    console.error("\n[FALHA NA REQUISIÇÃO HTTP]");
    console.error("Rota:", path);
    console.error("URL:", url);
    console.error("Tipo do erro:", err.name);
    console.error("Mensagem:", err.message);

    if (err.cause) {
      console.error("Causa original:", err.cause.message || err.cause);
      console.error("Código da causa:", err.cause.code || "Não informado");
      console.error("Tipo da causa:", err.cause.name || "Não informado");
    }

    console.error("Stack:", err.stack);

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Proteção do ambiente de banco de dados.
 * Confirma que o pool está estritamente conectado à branch Neon staging-auth.
 * Nunca exibe credenciais, senhas ou a string de conexão nos logs.
 */
async function verifyDatabaseEnvironment() {
  console.log(`${colors.yellow}Verificando identificação do banco de dados e branch Neon...${colors.reset}`);

  const query = `
    SELECT
      current_database() AS db_name,
      current_setting('neon.endpoint_id', true) AS endpoint_id,
      current_setting('neon.branch_id', true) AS branch_id
  `;

  const { rows } = await pool.query(query);
  const current = rows[0] || {};

  const dbMatches = current.db_name === EXPECTED_NEON_DB;
  const endpointMatches = current.endpoint_id === EXPECTED_NEON_ENDPOINT;
  const branchMatches = current.branch_id === EXPECTED_NEON_BRANCH_ID;

  if (!dbMatches || !endpointMatches || !branchMatches) {
    console.error(
      `${colors.red}${colors.bold}[ABORTADO] O banco de dados conectado NÃO corresponde com segurança à branch 'staging-auth'.${colors.reset}`,
    );
    console.error(
      `${colors.red}Esperado: db='${EXPECTED_NEON_DB}', endpoint='${EXPECTED_NEON_ENDPOINT}', branch_id='${EXPECTED_NEON_BRANCH_ID}'${colors.reset}`,
    );
    console.error(
      `${colors.red}Obtido: db='${current.db_name}', endpoint='${current.endpoint_id}', branch_id='${current.branch_id}'${colors.reset}`,
    );
    throw new Error("Ambiente inválido para execução da suíte de testes. Abortando imediatamente.");
  }

  console.log(
    `  ${colors.green}Ambiente confirmado com sucesso:${colors.reset} Neon Staging (${EXPECTED_NEON_BRANCH_ID}).`,
  );
}

/**
 * Captura um snapshot dos dados preexistentes relevantes para validação de integridade.
 * Inclui fingerprint criptográfico de campos sensíveis (password_hash via md5) sem expor senhas.
 */
async function capturePreexistingSnapshot() {
  const usersRes = await pool.query(`
    SELECT
      id,
      name,
      email,
      created_at,
      claimed_at,
      md5(coalesce(password_hash, '')) AS pwd_fingerprint
    FROM users
    ORDER BY id ASC
  `);

  const studentsRes = await pool.query(
    "SELECT id, name, guardian_name, guardian_email, is_active, user_id, created_at FROM students ORDER BY id ASC",
  );
  const monthsRes = await pool.query(
    "SELECT id, year, month, user_id, created_at FROM reference_months ORDER BY id ASC",
  );
  const recordsRes = await pool.query(
    "SELECT id, student_id, reference_month_id, student_name, amount, due_date, is_paid, user_id, created_at FROM monthly_records ORDER BY id ASC",
  );

  return {
    users: usersRes.rows,
    students: studentsRes.rows,
    months: monthsRes.rows,
    records: recordsRes.rows,
  };
}

/**
 * Rotina robusta de limpeza de registros temporários.
 * Respeita a ordem estrita de FKs: records -> months -> students -> users.
 * Protege explicitamente os IDs preexistentes (1, 3, 4) e confirma contagens.
 */
async function runSafeCleanup() {
  console.log(
    `\n${colors.yellow}Realizando limpeza segura dos dados temporários criados exclusivamente pela suíte...${colors.reset}`,
  );

  // 1. Mensalidades temporárias (se alguma foi criada)
  if (createdMonthlyRecordIds.length > 0) {
    try {
      const res = await pool.query(
        "DELETE FROM monthly_records WHERE id = ANY($1::int[]) AND user_id NOT IN (1, 3, 4)",
        [createdMonthlyRecordIds],
      );
      console.log(
        `  - Mensalidades temporárias removidas: ${res.rowCount} de ${createdMonthlyRecordIds.length} esperada(s).`,
      );
      if (res.rowCount !== createdMonthlyRecordIds.length) {
        failures.push(
          `[CLEANUP_WARN] Divergência na remoção de mensalidades: removidas ${res.rowCount}, esperadas ${createdMonthlyRecordIds.length}`,
        );
        failedCount++;
      }
    } catch (cleanErr) {
      console.error("  - Erro ao remover mensalidades temporárias:", cleanErr.message);
      failures.push(`[CLEANUP_FAIL] Falha ao remover mensalidades temporárias: ${cleanErr.message}`);
      failedCount++;
    }
  }

  // 2. Meses de referência temporários (incluindo o mês de teste 2038/12 do Usuário 4 no TEST 5.2)
  if (createdReferenceMonthIds.length > 0) {
    try {
      const res = await pool.query(
        `DELETE FROM reference_months
         WHERE id = ANY($1::int[])
           AND id NOT IN (1)
           AND (
             (user_id = 4 AND year = 2038 AND month = 12)
             OR user_id NOT IN (1, 3, 4)
           )`,
        [createdReferenceMonthIds],
      );
      console.log(
        `  - Meses temporários removidos: ${res.rowCount} de ${createdReferenceMonthIds.length} esperado(s).`,
      );
      if (res.rowCount !== createdReferenceMonthIds.length) {
        failures.push(
          `[CLEANUP_WARN] Divergência na remoção de meses: removidos ${res.rowCount}, esperados ${createdReferenceMonthIds.length}`,
        );
        failedCount++;
      }
    } catch (cleanErr) {
      console.error("  - Erro ao remover meses temporários:", cleanErr.message);
      failures.push(`[CLEANUP_FAIL] Falha ao remover meses temporários: ${cleanErr.message}`);
      failedCount++;
    }
  }

  // 3. Alunos temporários
  if (createdStudentIds.length > 0) {
    try {
      const res = await pool.query(
        `DELETE FROM students
         WHERE id = ANY($1::int[])
           AND id NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12)
           AND user_id NOT IN (1, 3, 4)`,
        [createdStudentIds],
      );
      console.log(`  - Alunos temporários removidos: ${res.rowCount} de ${createdStudentIds.length} esperado(s).`);
      if (res.rowCount !== createdStudentIds.length) {
        failures.push(
          `[CLEANUP_WARN] Divergência na remoção de alunos: removidos ${res.rowCount}, esperados ${createdStudentIds.length}`,
        );
        failedCount++;
      }
    } catch (cleanErr) {
      console.error("  - Erro ao remover alunos temporários:", cleanErr.message);
      failures.push(`[CLEANUP_FAIL] Falha ao remover alunos temporários: ${cleanErr.message}`);
      failedCount++;
    }
  }

  // 4. Usuários temporários criados pela suíte
  const safeUserIds = createdUserIds.filter((id) => id !== 1 && id !== 3 && id !== 4);
  if (safeUserIds.length > 0) {
    try {
      const res = await pool.query(
        `DELETE FROM users
         WHERE id = ANY($1::int[])
           AND id NOT IN (1, 3, 4)
           AND email LIKE 'audit.temp.%'`,
        [safeUserIds],
      );
      console.log(`  - Usuários temporários removidos: ${res.rowCount} de ${safeUserIds.length} esperado(s).`);
      if (res.rowCount !== safeUserIds.length) {
        failures.push(
          `[CLEANUP_WARN] Divergência na remoção de usuários: removidos ${res.rowCount}, esperados ${safeUserIds.length}`,
        );
        failedCount++;
      }
    } catch (cleanErr) {
      console.error("  - Erro ao remover usuários temporários:", cleanErr.message);
      failures.push(`[CLEANUP_FAIL] Falha ao remover usuários temporários: ${cleanErr.message}`);
      failedCount++;
    }
  }

  // 5. Verificação pós-limpeza (confirmação direta de resíduos na base)
  try {
    let orphanRecords = 0;
    if (createdMonthlyRecordIds.length > 0) {
      const q = await pool.query("SELECT COUNT(*) AS c FROM monthly_records WHERE id = ANY($1::int[])", [
        createdMonthlyRecordIds,
      ]);
      orphanRecords += Number(q.rows[0].c);
    }
    if (createdReferenceMonthIds.length > 0) {
      const q = await pool.query("SELECT COUNT(*) AS c FROM reference_months WHERE id = ANY($1::int[])", [
        createdReferenceMonthIds,
      ]);
      orphanRecords += Number(q.rows[0].c);
    }
    if (createdStudentIds.length > 0) {
      const q = await pool.query("SELECT COUNT(*) AS c FROM students WHERE id = ANY($1::int[])", [createdStudentIds]);
      orphanRecords += Number(q.rows[0].c);
    }
    if (safeUserIds.length > 0) {
      const q = await pool.query("SELECT COUNT(*) AS c FROM users WHERE id = ANY($1::int[])", [safeUserIds]);
      orphanRecords += Number(q.rows[0].c);
    }

    assert(
      orphanRecords === 0,
      "TEST 8.2",
      "Verificação pós-limpeza: todos os registros temporários criados foram completamente removidos da base",
      orphanRecords === 0 ? "0 registros órfãos" : `${orphanRecords} registros ainda presentes na base!`,
    );
  } catch (verifyErr) {
    failures.push(`[CLEANUP_VERIFY_FAIL] Falha ao consultar registros residuais: ${verifyErr.message}`);
    failedCount++;
  }

  // 6. Encerramento garantido do pool PostgreSQL
  try {
    await pool.end();
    console.log(`  - Conexão do pool PostgreSQL encerrada com sucesso.`);
  } catch (poolErr) {
    console.error("  - Erro ao encerrar o pool PostgreSQL:", poolErr.message);
  }
}

async function runAuditSuite() {
  console.log(`${colors.bold}${colors.blue}INICIANDO SUÍTE DE TESTES DE INTEGRAÇÃO MULTIUSUÁRIO${colors.reset}`);
  console.log(`Alvo HTTP: ${BASE_URL}`);
  console.log(`Data/Hora: ${new Date().toISOString()}\n`);

  let initialSnapshot = null;
  let executionError = null;

  const timestamp = Date.now();
  const testUserAEmail = `audit.temp.a.${timestamp}@test.local`;
  const testUserBEmail = `audit.temp.b.${timestamp}@test.local`;
  const testUserPassword = "PasswordSegura123!";

  let tokenUserA = null;
  let tokenUserB = null;
  let userAId = null;
  let userBId = null;
  let userBCreatedSuccessfully = false;

  let tokenUser3 = null;
  let tokenUser4 = null;
  let user3Authenticated = false;
  let user4Authenticated = false;

  try {
    // ======================================================================
    // ETAPA PREPARATÓRIA: VERIFICAÇÃO DO BANCO E SNAPSHOT INICIAL
    // ======================================================================
    await verifyDatabaseEnvironment();

    // Snapshot inicial dos dados preexistentes
    initialSnapshot = await capturePreexistingSnapshot();

    // ======================================================================
    // SUÍTE 1: AUTENTICAÇÃO JWT E CADASTRO
    // ======================================================================
    logSection("SUÍTE 1: AUTENTICAÇÃO JWT E CADASTRO");

    // 1.1 Cadastro com nome vazio
    {
      const res = await request("/api/auth/register", {
        method: "POST",
        simulatedIp: "10.1.1.1",
        body: { name: "   ", email: `valido.${timestamp}@test.local`, password: testUserPassword },
      });
      assert(
        res.status === 400 && res.data?.error?.status === 400 && typeof res.data?.error?.message === "string",
        "TEST 1.1",
        "Cadastro com nome vazio deve retornar HTTP 400 e envelope padronizado",
        `Status: ${res.status}`,
      );
    }

    // 1.2 Cadastro com e-mail inválido
    {
      const res = await request("/api/auth/register", {
        method: "POST",
        simulatedIp: "10.1.1.2",
        body: { name: "Usuario Teste", email: "email-invalido", password: testUserPassword },
      });
      assert(
        res.status === 400 && res.data?.error?.status === 400,
        "TEST 1.2",
        "Cadastro com e-mail sem formato válido deve retornar HTTP 400",
        `Status: ${res.status}`,
      );
    }

    // 1.3 Cadastro com senha curta (< 8 caracteres)
    {
      const res = await request("/api/auth/register", {
        method: "POST",
        simulatedIp: "10.1.1.3",
        body: { name: "Usuario Teste", email: `curta.${timestamp}@test.local`, password: "123" },
      });
      assert(
        res.status === 400 && res.data?.error?.status === 400,
        "TEST 1.3",
        "Cadastro com senha < 8 caracteres deve retornar HTTP 400",
        `Status: ${res.status}`,
      );
    }

    // 1.4 Cadastro com senha longa (> 72 bytes)
    {
      const longPassword = "A".repeat(73);
      const res = await request("/api/auth/register", {
        method: "POST",
        simulatedIp: "10.1.1.4",
        body: { name: "Usuario Teste", email: `longa.${timestamp}@test.local`, password: longPassword },
      });
      assert(
        res.status === 400 && res.data?.error?.status === 400,
        "TEST 1.4",
        "Cadastro com senha > 72 bytes deve retornar HTTP 400",
        `Status: ${res.status}`,
      );
    }

    // 1.5 Cadastro válido de novo usuário (User A)
    {
      const res = await request("/api/auth/register", {
        method: "POST",
        simulatedIp: "10.1.1.5",
        body: { name: "Auditoria User A", email: testUserAEmail, password: testUserPassword },
      });

      const user = res.data?.user;
      tokenUserA = res.data?.token;
      userAId = user?.id;

      if (userAId) createdUserIds.push(userAId);

      assert(
        res.status === 201 &&
          typeof tokenUserA === "string" &&
          tokenUserA.length > 20 &&
          Number.isInteger(userAId) &&
          userAId > 0 &&
          user?.email === testUserAEmail.toLowerCase() &&
          user?.name === "Auditoria User A" &&
          user.password_hash === undefined,
        "TEST 1.5",
        "Cadastro válido do Usuário A retorna HTTP 201, token JWT, ID válido e sem password_hash",
        `Status: ${res.status}, user_id: ${userAId}`,
      );
    }

    // 1.6 Cadastro válido de usuário auxiliar (User B) com validação estrita
    {
      const res = await request("/api/auth/register", {
        method: "POST",
        simulatedIp: "10.1.1.6",
        body: { name: "Auditoria User B", email: testUserBEmail, password: testUserPassword },
      });

      const userB = res.data?.user;
      tokenUserB = res.data?.token;
      userBId = userB?.id;

      const isRegistrationBValid =
        res.status === 201 &&
        typeof tokenUserB === "string" &&
        tokenUserB.length > 20 &&
        Number.isInteger(userBId) &&
        userBId > 0 &&
        userB?.email === testUserBEmail.toLowerCase() &&
        userB?.name === "Auditoria User B" &&
        userB.password_hash === undefined;

      if (userBId) {
        createdUserIds.push(userBId);
      }
      userBCreatedSuccessfully = isRegistrationBValid;

      assert(
        isRegistrationBValid,
        "TEST 1.6",
        "Cadastro válido do Usuário B retorna HTTP 201, token JWT, ID válido e sem password_hash",
        `Status: ${res.status}, user_id: ${userBId}`,
      );
    }

    // 1.7 Cadastro duplicado com mesmo e-mail
    {
      const res = await request("/api/auth/register", {
        method: "POST",
        simulatedIp: "10.1.1.7",
        body: { name: "Outro Nome", email: testUserAEmail, password: testUserPassword },
      });
      assert(
        res.status === 409 && res.data?.error?.status === 409,
        "TEST 1.7",
        "Tentativa de cadastro com e-mail já existente deve retornar HTTP 409",
        `Status: ${res.status}`,
      );
    }

    // 1.8 Login com credenciais válidas
    {
      const res = await request("/api/auth/login", {
        method: "POST",
        simulatedIp: "10.1.1.8",
        body: { email: testUserAEmail, password: testUserPassword },
      });
      assert(
        res.status === 200 &&
          typeof res.data?.token === "string" &&
          res.data?.user?.id === userAId &&
          res.data?.user?.password_hash === undefined,
        "TEST 1.8",
        "Login válido retorna HTTP 200, token JWT e dados corretos",
        `Status: ${res.status}`,
      );
    }

    // 1.9 Login com senha incorreta
    {
      const res = await request("/api/auth/login", {
        method: "POST",
        simulatedIp: "10.1.1.9",
        body: { email: testUserAEmail, password: "SenhaIncorreta999!" },
      });
      assert(
        res.status === 401 &&
          res.data?.error?.status === 401 &&
          res.data?.error?.message === "E-mail ou senha incorretos.",
        "TEST 1.9",
        "Login com senha incorreta deve retornar HTTP 401 com mensagem segura",
        `Status: ${res.status}`,
      );
    }

    // 1.10 Login com e-mail inexistente
    {
      const res = await request("/api/auth/login", {
        method: "POST",
        simulatedIp: "10.1.1.10",
        body: { email: `inexistente.${timestamp}@test.local`, password: "QualquerSenha123!" },
      });
      assert(
        res.status === 401 &&
          res.data?.error?.status === 401 &&
          res.data?.error?.message === "E-mail ou senha incorretos.",
        "TEST 1.10",
        "Login com e-mail inexistente deve retornar HTTP 401 com mensagem segura idêntica",
        `Status: ${res.status}`,
      );
    }

    // 1.11 Tentativa de login na conta legada sem senha
    {
      const res = await request("/api/auth/login", {
        method: "POST",
        simulatedIp: "10.1.1.11",
        body: { email: "legado@studenttracker.local", password: "QualquerSenha123!" },
      });
      assert(
        res.status === 401 && res.data?.error?.status === 401,
        "TEST 1.11",
        "Tentativa de login na conta legada desativada deve retornar HTTP 401",
        `Status: ${res.status}`,
      );
    }

    // 1.12 Consulta /api/auth/me autenticado
    {
      const res = await request("/api/auth/me", {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(
        res.status === 200 && res.data?.user?.id === userAId && res.data?.user?.email === testUserAEmail.toLowerCase(),
        "TEST 1.12",
        "Consulta em /api/auth/me retorna os dados exatos do usuário autenticado",
        `Status: ${res.status}`,
      );
    }

    // 1.13 Login explícito do Usuário 3 (teste1@example.com)
    {
      const res3 = await request("/api/auth/login", {
        method: "POST",
        simulatedIp: "10.1.1.12",
        body: { email: "teste1@example.com", password: "SenhaTeste123!" },
      });

      tokenUser3 = res3.data?.token;
      user3Authenticated =
        res3.status === 200 &&
        typeof tokenUser3 === "string" &&
        tokenUser3.length > 20 &&
        res3.data?.user?.id === 3 &&
        res3.data?.user?.email === "teste1@example.com";

      assert(
        user3Authenticated,
        "TEST 1.13",
        "Login do Usuário 3 preexistente retorna HTTP 200, token JWT, ID 3 e e-mail esperado",
        `Status: ${res3.status}, user_id: ${res3.data?.user?.id}`,
      );
    }

    // 1.14 Login explícito do Usuário 4 (teste2@example.com)
    {
      const res4 = await request("/api/auth/login", {
        method: "POST",
        simulatedIp: "10.1.1.13",
        body: { email: "teste2@example.com", password: "SenhaTeste456!" },
      });

      tokenUser4 = res4.data?.token;
      user4Authenticated =
        res4.status === 200 &&
        typeof tokenUser4 === "string" &&
        tokenUser4.length > 20 &&
        res4.data?.user?.id === 4 &&
        res4.data?.user?.email === "teste2@example.com";

      assert(
        user4Authenticated,
        "TEST 1.14",
        "Login do Usuário 4 preexistente retorna HTTP 200, token JWT, ID 4 e e-mail esperado",
        `Status: ${res4.status}, user_id: ${res4.data?.user?.id}`,
      );
    }

    // ======================================================================
    // VERIFICAÇÃO OBRIGATÓRIA DE PARIDADE (API LOCAL vs BANCO NEON)
    // ======================================================================
    {
      console.log(
        `\n${colors.yellow}Executando verificação obrigatória de paridade entre API HTTP e PostgreSQL Neon...${colors.reset}`,
      );

      if (!user3Authenticated) {
        throw new Error(
          "FALHA DE PARIDADE: Autenticação do Usuário 3 falhou. Impossível realizar o teste canário de paridade API/Banco.",
        );
      }

      const apiStudentRes = await request("/api/students/12", {
        headers: { Authorization: `Bearer ${tokenUser3}` },
      });
      const dbStudentRes = await pool.query("SELECT id, user_id FROM students WHERE id = 12");

      const canaryApi = apiStudentRes.status === 200 && apiStudentRes.data?.id === 12;
      const canaryDb = dbStudentRes.rows.length === 1 && dbStudentRes.rows[0].user_id === 3;

      if (!canaryApi || !canaryDb) {
        console.error(
          `${colors.red}${colors.bold}[FALHA CRÍTICA DE PARIDADE] A API local e o script NÃO estão enxergando os mesmos registros!${colors.reset}`,
        );
        console.error(
          `${colors.red}API Status: ${apiStudentRes.status}, DB Encontrado: ${dbStudentRes.rows.length}${colors.reset}`,
        );
        throw new Error(
          "FALHA DE PARIDADE OBRIGATÓRIA: A API HTTP e o pool PostgreSQL divergem sobre os registros da base. Abortando imediatamente para prevenir corrupção de dados.",
        );
      }

      console.log(`  ${colors.green}Paridade API/Banco validada com sucesso.${colors.reset}\n`);
    }

    // ======================================================================
    // SUÍTE 2: PROTEÇÃO DE ROTAS CONTRA ACESSO NÃO AUTENTICADO
    // ======================================================================
    logSection("SUÍTE 2: PROTEÇÃO DE ROTAS SEM AUTENTICAÇÃO");

    const protectedEndpoints = [
      { method: "GET", path: "/api/auth/me", name: "GET /api/auth/me" },
      { method: "GET", path: "/api/students", name: "GET /api/students" },
      { method: "POST", path: "/api/students", name: "POST /api/students" },
      { method: "GET", path: "/api/students/12", name: "GET /api/students/:id" },
      { method: "PUT", path: "/api/students/12", name: "PUT /api/students/:id" },
      { method: "PATCH", path: "/api/students/12/status", name: "PATCH /api/students/:id/status" },
      { method: "GET", path: "/api/months", name: "GET /api/months" },
      { method: "POST", path: "/api/months/copy", name: "POST /api/months/copy" },
      { method: "DELETE", path: "/api/months/1", name: "DELETE /api/months/:id" },
      { method: "GET", path: "/api/months/1/records", name: "GET /api/months/:id/records" },
      { method: "POST", path: "/api/months/1/records", name: "POST /api/months/:id/records" },
      { method: "PUT", path: "/api/months/records/1", name: "PUT /api/months/records/:id" },
      { method: "PATCH", path: "/api/months/records/1/payment", name: "PATCH /api/months/records/:id/payment" },
      { method: "DELETE", path: "/api/months/records/1", name: "DELETE /api/months/records/:id" },
      { method: "POST", path: "/api/assistant/message", name: "POST /api/assistant/message" },
    ];

    let allBlockedNoToken = true;
    for (const endpoint of protectedEndpoints) {
      const res = await request(endpoint.path, { method: endpoint.method });
      if (res.status !== 401 || res.data?.error?.status !== 401) {
        allBlockedNoToken = false;
        console.log(`      ${colors.red}Falha em bloquear: ${endpoint.name} (Status: ${res.status})${colors.reset}`);
      }
    }
    assert(
      allBlockedNoToken,
      "TEST 2.1",
      "Todas as 15 rotas protegidas rejeitam requisições sem token com HTTP 401",
      allBlockedNoToken ? "15/15 rotas bloqueadas" : "Uma ou mais rotas permitiram acesso sem token",
    );

    // 2.2 Token malformado
    {
      const res = await request("/api/students", {
        headers: { Authorization: "Bearer token_completamente_invalido" },
      });
      assert(
        res.status === 401 && res.data?.error?.status === 401,
        "TEST 2.2",
        "Token malformado deve ser rejeitado com HTTP 401",
        `Status: ${res.status}`,
      );
    }

    // 2.3 Token assinado com segredo adulterado
    {
      const forgedToken = jwt.sign({}, "segredo_falso_com_mais_de_32_caracteres_12345", {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: "student-payment-tracker",
        audience: "student-payment-tracker-api",
        subject: "3",
      });
      const res = await request("/api/students", {
        headers: { Authorization: `Bearer ${forgedToken}` },
      });
      assert(
        res.status === 401 && res.data?.error?.status === 401,
        "TEST 2.3",
        "Token forjado com chave incorreta deve ser rejeitado com HTTP 401",
        `Status: ${res.status}`,
      );
    }

    // 2.4 Token com subject inexistente no banco
    {
      const secret = process.env.JWT_SECRET;
      const ghostToken = jwt.sign({}, secret, {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: "student-payment-tracker",
        audience: "student-payment-tracker-api",
        subject: "999999",
      });
      const res = await request("/api/students", {
        headers: { Authorization: `Bearer ${ghostToken}` },
      });
      assert(
        res.status === 401 && res.data?.error?.status === 401,
        "TEST 2.4",
        "Token com subject de usuário inexistente no banco deve ser rejeitado com HTTP 401",
        `Status: ${res.status}`,
      );
    }

    // ======================================================================
    // SUÍTE 3: ISOLAMENTO DE ALUNOS (IDOR / BOLA)
    // ======================================================================
    logSection("SUÍTE 3: ISOLAMENTO DE ALUNOS");

    // 3.1 Usuário 3 lista alunos e confirma especificamente seu aluno ID 12 (com validação segura de array)
    {
      if (!user3Authenticated) {
        assert(false, "TEST 3.1", "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/students", {
          headers: { Authorization: `Bearer ${tokenUser3}` },
        });

        const isArray = Array.isArray(res.data);
        const students = isArray ? res.data : [];
        const hasLegacyStudents = isArray && students.some((s) => s && s.id <= 10);
        const isExactlyStudent12 = isArray && students.length === 1 && students[0]?.id === 12;

        assert(
          res.status === 200 && isArray && students.length === 1 && isExactlyStudent12 && !hasLegacyStudents,
          "TEST 3.1",
          "Usuário 3 lista exatamente 1 aluno, com ID 12, e nenhum aluno legado (1 a 10) aparece",
          `Status: ${res.status}, isArray: ${isArray}, Alunos retornados: ${isArray ? students.length : "N/A"}`,
        );
      }
    }

    // 3.2 Usuário 4 lista alunos e não visualiza aluno do Usuário 3
    {
      if (!user4Authenticated) {
        assert(false, "TEST 3.2", "Autenticação prévia do Usuário 4 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/students", {
          headers: { Authorization: `Bearer ${tokenUser4}` },
        });
        const isArray = Array.isArray(res.data);
        const students = isArray ? res.data : [];
        assert(
          res.status === 200 && isArray && students.length === 0,
          "TEST 3.2",
          "Usuário 4 possui lista vazia e não visualiza aluno do Usuário 3",
          `Alunos retornados: ${isArray ? students.length : "N/A"}`,
        );
      }
    }

    // 3.3 Usuário 4 tenta ler diretamente aluno ID 12 do Usuário 3
    {
      if (!user4Authenticated) {
        assert(false, "TEST 3.3", "Autenticação prévia do Usuário 4 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/students/12", {
          headers: { Authorization: `Bearer ${tokenUser4}` },
        });
        assert(
          res.status === 404 && res.data?.error?.status === 404,
          "TEST 3.3",
          "Usuário 4 não consegue acessar aluno ID 12 do Usuário 3 (retorna HTTP 404)",
          `Status: ${res.status}`,
        );
      }
    }

    // 3.4 Usuário 4 tenta alterar aluno ID 12 do Usuário 3
    {
      if (!user4Authenticated) {
        assert(false, "TEST 3.4", "Autenticação prévia do Usuário 4 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/students/12", {
          method: "PUT",
          headers: { Authorization: `Bearer ${tokenUser4}` },
          body: { name: "Tentativa Invasao", guardian_name: null, guardian_email: null },
        });

        const checkDb = await pool.query("SELECT name FROM students WHERE id = 12");

        assert(
          res.status === 404 && res.data?.error?.status === 404 && checkDb.rows[0]?.name === "Aluno Teste Usuario 3",
          "TEST 3.4",
          "Usuário 4 não consegue alterar aluno ID 12 do Usuário 3 (retorna HTTP 404 e nome intacto no banco)",
          `Status: ${res.status}`,
        );
      }
    }

    // 3.5 Usuário 4 tenta inativar aluno ID 12 do Usuário 3
    {
      if (!user4Authenticated) {
        assert(false, "TEST 3.5", "Autenticação prévia do Usuário 4 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/students/12/status", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${tokenUser4}` },
          body: { is_active: false },
        });

        const checkDb = await pool.query("SELECT is_active FROM students WHERE id = 12");

        assert(
          res.status === 404 && res.data?.error?.status === 404 && checkDb.rows[0]?.is_active === true,
          "TEST 3.5",
          "Usuário 4 não consegue alterar status do aluno ID 12 do Usuário 3 (retorna HTTP 404 e is_active intacto)",
          `Status: ${res.status}`,
        );
      }
    }

    // 3.6 Usuário 3 tenta ler aluno legado ID 1
    {
      if (!user3Authenticated) {
        assert(false, "TEST 3.6", "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/students/1", {
          headers: { Authorization: `Bearer ${tokenUser3}` },
        });
        assert(
          res.status === 404 && res.data?.error?.status === 404,
          "TEST 3.6",
          "Usuário 3 não consegue ler diretamente aluno legado ID 1 (retorna HTTP 404)",
          `Status: ${res.status}`,
        );
      }
    }

    // 3.7 Criação e isolamento cruzado com novos usuários A e B (com confirmação direta de user_id no banco)
    let createdStudentAId = null;
    {
      if (!userBCreatedSuccessfully || !tokenUserA || !tokenUserB || !userAId) {
        assert(
          false,
          "TEST 3.7",
          "Usuário A ou Usuário B não foram cadastrados com sucesso. Teste dependente abortado.",
        );
      } else {
        const studentName = `Audit Test Student A ${timestamp}`;
        const resCreate = await request("/api/students", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenUserA}` },
          body: { name: studentName, guardian_name: "Responsavel A", guardian_email: "resp.a@test.local" },
        });

        createdStudentAId = resCreate.data?.id;

        if (!Number.isInteger(createdStudentAId) || createdStudentAId <= 0) {
          assert(false, "TEST 3.7", "Criação do aluno temporário do Usuário A falhou. Leitura cruzada abortada.");
        } else {
          createdStudentIds.push(createdStudentAId);

          // Confirma diretamente no PostgreSQL que o aluno foi associado ao userAId correto
          const studentDb = await pool.query("SELECT id, user_id FROM students WHERE id = $1", [createdStudentAId]);
          const associatedWithUserA = studentDb.rows.length === 1 && studentDb.rows[0].user_id === userAId;

          // Usuário B tenta ler o aluno do Usuário A
          const resBRead = await request(`/api/students/${createdStudentAId}`, {
            headers: { Authorization: `Bearer ${tokenUserB}` },
          });

          assert(
            resCreate.status === 201 && associatedWithUserA && resBRead.status === 404,
            "TEST 3.7",
            "Usuário A cria aluno (user_id validado no banco) e Usuário B recebe HTTP 404 ao tentar acessá-lo por ID",
            `Create Status: ${resCreate.status}, DB user_id: ${studentDb.rows[0]?.user_id}, Read B Status: ${resBRead.status}`,
          );
        }
      }
    }

    // 3.8 Rejeição de campos não permitidos no cadastro de alunos (prevenção de injeção de user_id)
    {
      const res = await request("/api/students", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenUserA}` },
        body: { name: "Aluno Teste Invalido", user_id: 1, id: 999 },
      });
      assert(
        res.status === 400 && res.data?.error?.status === 400,
        "TEST 3.8",
        "Tentativa de injetar user_id no cadastro de alunos deve ser rejeitada com HTTP 400",
        `Status: ${res.status}`,
      );
    }

    // ======================================================================
    // SUÍTE 4: ISOLAMENTO DE MESES DE REFERÊNCIA E CÓPIA
    // ======================================================================
    logSection("SUÍTE 4: ISOLAMENTO DE MESES DE REFERÊNCIA E CÓPIA");

    // 4.1 Listagem de meses independente
    {
      if (!user3Authenticated || !user4Authenticated) {
        assert(false, "TEST 4.1", "Autenticação prévia dos Usuários 3 e 4 falhou. Teste dependente abortado.");
      } else {
        const res3 = await request("/api/months", { headers: { Authorization: `Bearer ${tokenUser3}` } });
        const res4 = await request("/api/months", { headers: { Authorization: `Bearer ${tokenUser4}` } });

        assert(
          res3.status === 200 &&
            Array.isArray(res3.data) &&
            res3.data.length === 0 &&
            res4.status === 200 &&
            Array.isArray(res4.data) &&
            res4.data.length === 0,
          "TEST 4.1",
          "Usuários 3 e 4 possuem listagens de meses vazias e isoladas dos meses legados",
          `Meses U3: ${res3.data?.length}, Meses U4: ${res4.data?.length}`,
        );
      }
    }

    // 4.2 Tentativa do Usuário 3 de copiar mês pertencente à conta legada (ID 1)
    {
      if (!user3Authenticated) {
        assert(false, "TEST 4.2", "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/months/copy", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenUser3}` },
          body: { source_reference_id: 1, target_year: 2026, target_month: 12 },
        });
        assert(
          res.status === 404 && res.data?.error?.status === 404 && typeof res.data?.error?.message === "string",
          "TEST 4.2",
          "Usuário 3 não consegue copiar mês pertencente à conta legada (bloqueado com HTTP 404)",
          `Status: ${res.status}`,
        );
      }
    }

    // 4.3 Tentativa de cópia com ano de destino fora do limite permitido (< 2000 ou > 2100)
    // NOTA TÉCNICA: Em monthlyService.copyMonthRecords(), a validação sintática em memória de target_year
    // ocorre antes da busca e verificação de posse do mês no banco. Portanto, o erro retornado é HTTP 400.
    {
      if (!user3Authenticated) {
        assert(false, "TEST 4.3", "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/months/copy", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenUser3}` },
          body: { source_reference_id: 1, target_year: 2150, target_month: 5 },
        });
        assert(
          res.status === 400 &&
            res.data?.error?.status === 400 &&
            res.data?.error?.message === "O campo target_year deve ser um ano válido entre 2000 e 2100.",
          "TEST 4.3",
          "Tentativa de cópia com target_year fora de 2000-2100 retorna HTTP 400 (validação antes da checagem de tenant)",
          `Status: ${res.status}, Mensagem: "${res.data?.error?.message}"`,
        );
      }
    }

    // 4.4 Consulta de registros de mês legado (ID 1) pelo Usuário 3
    {
      if (!user3Authenticated) {
        assert(false, "TEST 4.4", "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/months/1/records", {
          headers: { Authorization: `Bearer ${tokenUser3}` },
        });
        assert(
          res.status === 404 && res.data?.error?.status === 404,
          "TEST 4.4",
          "Usuário 3 não consegue consultar registros do mês legado ID 1 (retorna HTTP 404)",
          `Status: ${res.status}`,
        );
      }
    }

    // 4.5 Consulta de registros de mês legado (ID 1) pelo Usuário 4
    {
      if (!user4Authenticated) {
        assert(false, "TEST 4.5", "Autenticação prévia do Usuário 4 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/months/1/records", {
          headers: { Authorization: `Bearer ${tokenUser4}` },
        });
        assert(
          res.status === 404 && res.data?.error?.status === 404,
          "TEST 4.5",
          "Usuário 4 não consegue consultar registros do mês legado ID 1 (retorna HTTP 404)",
          `Status: ${res.status}`,
        );
      }
    }

    // 4.6 Tentativa de exclusão de mês legado (ID 1) pelo Usuário 3
    {
      if (!user3Authenticated) {
        assert(false, "TEST 4.6", "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/months/1", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenUser3}` },
        });
        assert(
          res.status === 404 && res.data?.error?.status === 404,
          "TEST 4.6",
          "Usuário 3 não consegue excluir mês legado ID 1 (retorna HTTP 404)",
          `Status: ${res.status}`,
        );
      }
    }

    // ======================================================================
    // SUÍTE 5: ISOLAMENTO DE MENSALIDADES (MONTHLY RECORDS)
    // ======================================================================
    logSection("SUÍTE 5: ISOLAMENTO DE MENSALIDADES");

    // 5.1 Usuário 3 tenta criar mensalidade em mês legado ID 1
    {
      if (!user3Authenticated) {
        assert(false, "TEST 5.1", "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/months/1/records", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenUser3}` },
          body: { student_id: 12, student_name: "Aluno Teste Usuario 3", amount: "150.00", due_date: "2026-05-10" },
        });
        assert(
          res.status === 404 && res.data?.error?.status === 404,
          "TEST 5.1",
          "Usuário 3 não consegue criar mensalidade em mês legado ID 1 (retorna HTTP 404)",
          `Status: ${res.status}`,
        );
      }
    }

    // 5.2 Isolamento entre mensalidades e alunos (Usuário 4 tenta vincular aluno do Usuário 3 em seu próprio mês)
    {
      if (!user4Authenticated) {
        assert(false, "TEST 5.2", "Autenticação prévia do Usuário 4 falhou. Teste dependente abortado.");
      } else {
        // Prepara um mês temporário legítimo no staging para o Usuário 4
        let tempMonthUser4Id = null;
        let monthCreated = false;

        try {
          const insertMonthRes = await pool.query(
            "INSERT INTO reference_months (year, month, user_id) VALUES ($1, $2, $3) RETURNING id, user_id",
            [2038, 12, 4],
          );
          tempMonthUser4Id = insertMonthRes.rows[0]?.id;
          if (tempMonthUser4Id) {
            createdReferenceMonthIds.push(tempMonthUser4Id);
            monthCreated = insertMonthRes.rows[0]?.user_id === 4;
          }
        } catch (err) {
          console.error("Falha ao preparar mês de teste para o Usuário 4:", err.message);
        }

        if (!monthCreated || !tempMonthUser4Id) {
          assert(
            false,
            "TEST 5.2",
            "Não foi possível preparar o mês temporário no banco de staging para o Usuário 4",
            "Mês temporário ausente",
          );
        } else {
          // Usuário 4 tenta cadastrar mensalidade em seu mês legítimo utilizando o aluno ID 12 (pertencente ao Usuário 3)
          const res = await request(`/api/months/${tempMonthUser4Id}/records`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tokenUser4}` },
            body: {
              student_id: 12,
              student_name: "Aluno Teste Usuario 3",
              amount: "200.00",
              due_date: "2038-12-10",
            },
          });

          // Consulta o banco para confirmar que nenhum registro indevido foi persistido
          const recordsInMonth = await pool.query(
            "SELECT COUNT(*) AS total FROM monthly_records WHERE reference_month_id = $1",
            [tempMonthUser4Id],
          );
          const zeroRecordsPersisted = Number(recordsInMonth.rows[0].total) === 0;

          assert(
            res.status === 404 && res.data?.error?.status === 404 && zeroRecordsPersisted,
            "TEST 5.2",
            "Usuário 4 é impedido de vincular aluno de outro usuário em seu próprio mês (HTTP 404 e 0 registros no banco)",
            `Status: ${res.status}, Registros no mês: ${recordsInMonth.rows[0].total}`,
          );
        }
      }
    }

    // 5.3 Usuário 3 tenta alterar registro mensal legado ID 1
    {
      if (!user3Authenticated) {
        assert(false, "TEST 5.3", "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/months/records/1", {
          method: "PUT",
          headers: { Authorization: `Bearer ${tokenUser3}` },
          body: { amount: "999.00", due_date: "2026-05-15" },
        });
        assert(
          res.status === 404 && res.data?.error?.status === 404,
          "TEST 5.3",
          "Usuário 3 não consegue alterar registro mensal legado ID 1 (retorna HTTP 404)",
          `Status: ${res.status}`,
        );
      }
    }

    // 5.4 Usuário 3 tenta alterar status de pagamento de registro mensal legado ID 1
    {
      if (!user3Authenticated) {
        assert(false, "TEST 5.4", "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/months/records/1/payment", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${tokenUser3}` },
          body: { is_paid: true },
        });
        assert(
          res.status === 404 && res.data?.error?.status === 404,
          "TEST 5.4",
          "Usuário 3 não consegue alterar pagamento de mensalidade legada ID 1 (retorna HTTP 404)",
          `Status: ${res.status}`,
        );
      }
    }

    // 5.5 Usuário 3 tenta excluir registro mensal legado ID 1
    {
      if (!user3Authenticated) {
        assert(false, "TEST 5.5", "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.");
      } else {
        const res = await request("/api/months/records/1", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenUser3}` },
        });
        assert(
          res.status === 404 && res.data?.error?.status === 404,
          "TEST 5.5",
          "Usuário 3 não consegue excluir registro mensal legado ID 1 (retorna HTTP 404)",
          `Status: ${res.status}`,
        );
      }
    }

    // 5.6 Usuário 4 tenta atualizar ou excluir registro mensal legado ID 1
    {
      if (!user4Authenticated) {
        assert(false, "TEST 5.6", "Autenticação prévia do Usuário 4 falhou. Teste dependente abortado.");
      } else {
        const resPut = await request("/api/months/records/1", {
          method: "PUT",
          headers: { Authorization: `Bearer ${tokenUser4}` },
          body: { amount: "500.00", due_date: "2026-05-20" },
        });
        const resDel = await request("/api/months/records/1", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenUser4}` },
        });
        assert(
          resPut.status === 404 && resDel.status === 404,
          "TEST 5.6",
          "Usuário 4 não consegue atualizar nem excluir registro mensal legado ID 1 (retorna HTTP 404)",
          `PUT: ${resPut.status}, DELETE: ${resDel.status}`,
        );
      }
    }

    // 5.7 Validação aprofundada das FKs compostas no catálogo do PostgreSQL
    {
      const queryFkDetails = `
        SELECT
          conname,
          conrelid::regclass::text AS source_table,
          confrelid::regclass::text AS target_table,
          convalidated,
          (
            SELECT array_agg(attname::text ORDER BY array_position(c.conkey, a.attnum))
            FROM pg_attribute a
            WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
          ) AS source_columns,
          (
            SELECT array_agg(attname::text ORDER BY array_position(c.confkey, a.attnum))
            FROM pg_attribute a
            WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)
          ) AS target_columns
        FROM pg_constraint c
        WHERE conname IN ('fk_monthly_reference_composed', 'fk_monthly_student_composed')
      `;

      const { rows } = await pool.query(queryFkDetails);

      const refFk = rows.find((r) => r.conname === "fk_monthly_reference_composed");
      const studentFk = rows.find((r) => r.conname === "fk_monthly_student_composed");

      const arraysEqual = (a, b) =>
        Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

      const refFkValid =
        refFk &&
        refFk.source_table.includes("monthly_records") &&
        refFk.target_table.includes("reference_months") &&
        arraysEqual(refFk.source_columns, ["reference_month_id", "user_id"]) &&
        arraysEqual(refFk.target_columns, ["id", "user_id"]) &&
        refFk.convalidated === true;

      const studentFkValid =
        studentFk &&
        studentFk.source_table.includes("monthly_records") &&
        studentFk.target_table.includes("students") &&
        arraysEqual(studentFk.source_columns, ["student_id", "user_id"]) &&
        arraysEqual(studentFk.target_columns, ["id", "user_id"]) &&
        studentFk.convalidated === true;

      assert(
        refFkValid && studentFkValid,
        "TEST 5.7",
        "Integridade Relacional: FKs compostas de meses e alunos devidamente configuradas e validadas no PostgreSQL",
        `Ref FK válida: ${Boolean(refFkValid)}, Student FK válida: ${Boolean(studentFkValid)}`,
      );
    }

    // ======================================================================
    // SUÍTE 6: ISOLAMENTO DO ASSISTENTE GEMINI (CONVERSAS E FERRAMENTAS)
    // ======================================================================
    logSection("SUÍTE 6: ISOLAMENTO DO ASSISTENTE GEMINI");

    // ----------------------------------------------------------------------
    // 6.A: TESTES QUE DEPENDEM DE API EXTERNA (GEMINI)
    // ----------------------------------------------------------------------
    let conversationIdU3 = null;
    {
      if (!user3Authenticated || !user4Authenticated) {
        assert(
          false,
          "TEST 6.1 [API EXTERNA GEMINI]",
          "Autenticação prévia dos Usuários 3 e 4 falhou. Teste dependente abortado.",
        );
      } else {
        // Usuário 3 inicia conversa com o assistente (aciona API externa Gemini)
        const resMsgU3 = await request("/api/assistant/message", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenUser3}` },
          body: { message: "Olá assistente" },
          timeoutMs: 30000,
        });

        conversationIdU3 = resMsgU3.data?.conversationId;

        if (conversationIdU3) {
          // Usuário 4 tenta injetar o conversationId pertencente ao Usuário 3
          const resMsgU4 = await request("/api/assistant/message", {
            method: "POST",
            headers: { Authorization: `Bearer ${tokenUser4}` },
            body: { conversationId: conversationIdU3, message: "Tentativa de espionagem" },
            timeoutMs: 30000,
          });

          assert(
            resMsgU4.status === 404 &&
              resMsgU4.data?.error?.status === 404 &&
              resMsgU4.data?.error?.message === "Conversa não encontrada ou expirada. Inicie uma nova conversa.",
            "TEST 6.1 [API EXTERNA GEMINI]",
            "Inicia conversa via Gemini para Usuário 3 e bloqueia hijacking pelo Usuário 4 com HTTP 404",
            `Status: ${resMsgU4.status}`,
          );
        } else {
          assert(
            false,
            "TEST 6.1 [API EXTERNA GEMINI]",
            "Não foi possível obter conversationId para o Usuário 3",
            JSON.stringify(resMsgU3.data),
          );
        }
      }
    }

    {
      if (!user3Authenticated) {
        assert(
          false,
          "TEST 6.2 [API EXTERNA GEMINI]",
          "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.",
        );
      } else {
        const resU3 = await request("/api/assistant/message", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenUser3}` },
          body: { message: "Quantos alunos estão cadastrados na minha conta?" },
          timeoutMs: 30000,
        });
        const textU3 = resU3.data?.response || "";
        const normalizedTextU3 = textU3.replace(/\*/g, "");
        const mentionsOneStudent = /\b1\s+aluno\b/i.test(normalizedTextU3);

        assert(
          resU3.status === 200 && mentionsOneStudent,
          "TEST 6.2 [API EXTERNA GEMINI]",
          "Gemini processa a pergunta e informa 1 aluno cadastrado para o Usuário 3",
          `Resposta: "${textU3.slice(0, 80)}..."`,
        );
      }
    }

    {
      if (!user4Authenticated) {
        assert(
          false,
          "TEST 6.3 [API EXTERNA GEMINI]",
          "Autenticação prévia do Usuário 4 falhou. Teste dependente abortado.",
        );
      } else {
        const resU4 = await request("/api/assistant/message", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenUser4}` },
          body: { message: "Quantos alunos estão cadastrados na minha conta?" },
          timeoutMs: 30000,
        });
        const textU4 = resU4.data?.response || "";
        const normalizedTextU4 = textU4.replace(/\*/g, "");
        const mentionsZeroStudents = /0 alunos|nenhum aluno/i.test(normalizedTextU4);

        assert(
          resU4.status === 200 && mentionsZeroStudents,
          "TEST 6.3 [API EXTERNA GEMINI]",
          "Gemini processa a pergunta e informa 0 alunos cadastrados para o Usuário 4",
          `Resposta: "${textU4.slice(0, 80)}..."`,
        );
      }
    }

    // ----------------------------------------------------------------------
    // 6.B: TESTES QUE EXECUTAM FERRAMENTAS SQL DIRETAMENTE (SEM CHAMADA EXTERNA)
    // ----------------------------------------------------------------------
    {
      const countU3 = await executeStudentTool("getStudentCount", 3);
      const countU4 = await executeStudentTool("getStudentCount", 4);

      assert(
        countU3?.totalStudents === 1 && countU4?.totalStudents === 0,
        "TEST 6.4 [FERRAMENTA SQL DIRETA]",
        "Ferramenta getStudentCount retorna 1 aluno para Usuário 3 e 0 alunos para Usuário 4",
        `U3: ${countU3?.totalStudents}, U4: ${countU4?.totalStudents}`,
      );
    }

    {
      const summaryU3 = await executePaymentTool("getMonthlyFinancialSummary", { year: 2026, month: 5 }, 3);
      assert(
        summaryU3?.found === false,
        "TEST 6.5 [FERRAMENTA SQL DIRETA]",
        "Ferramenta getMonthlyFinancialSummary retorna found: false para mês inexistente no tenant",
        `found: ${summaryU3?.found}`,
      );
    }

    {
      const paymentsU3 = await executePaymentTool(
        "getMonthlyPaymentsByStatus",
        { year: 2026, month: 5, status: "Todos" },
        3,
      );
      assert(
        paymentsU3?.found === false && paymentsU3?.records?.length === 0,
        "TEST 6.6 [FERRAMENTA SQL DIRETA]",
        "Ferramenta getMonthlyPaymentsByStatus retorna found: false e 0 registros para mês inexistente no tenant",
        `found: ${paymentsU3?.found}`,
      );
    }

    // ----------------------------------------------------------------------
    // 6.C: TESTES QUE VERIFICAM SOMENTE VALIDAÇÕES LOCAIS (SEM CHAMADA EXTERNA)
    // ----------------------------------------------------------------------
    {
      if (!user3Authenticated) {
        assert(
          false,
          "TEST 6.7 [VALIDAÇÃO LOCAL]",
          "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.",
        );
      } else {
        const res = await request("/api/assistant/message", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenUser3}` },
          body: { message: "   " },
        });
        assert(
          res.status === 400 && res.data?.error?.status === 400,
          "TEST 6.7 [VALIDAÇÃO LOCAL]",
          "Mensagem vazia no assistente deve retornar HTTP 400",
          `Status: ${res.status}`,
        );
      }
    }

    {
      if (!user3Authenticated) {
        assert(
          false,
          "TEST 6.8 [VALIDAÇÃO LOCAL]",
          "Autenticação prévia do Usuário 3 falhou. Teste dependente abortado.",
        );
      } else {
        const longMsg = "A".repeat(4001);
        const res = await request("/api/assistant/message", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenUser3}` },
          body: { message: longMsg },
        });
        assert(
          res.status === 400 && res.data?.error?.status === 400,
          "TEST 6.8 [VALIDAÇÃO LOCAL]",
          "Mensagem > 4000 caracteres no assistente deve retornar HTTP 400",
          `Status: ${res.status}`,
        );
      }
    }

    // ======================================================================
    // SUÍTE 7: RATE LIMITING E VALIDAÇÕES DE ENTRADA
    // ======================================================================
    logSection("SUÍTE 7: RATE LIMITING E VALIDAÇÕES DE ENTRADA");

    // 7.1 Rate limiting na autenticação: 10 primeiras requisições retornam estritamente HTTP 401 e a 11ª HTTP 429
    {
      const rateLimitIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
      let first10All401 = true;
      let unexpectedStatusDetail = "";
      let request11Blocked429 = false;

      for (let i = 1; i <= 10; i++) {
        const res = await request("/api/auth/login", {
          method: "POST",
          headers: { "X-Forwarded-For": rateLimitIp },
          body: { email: "email_qualquer@test.local", password: "SenhaIncorreta123!" },
        });

        if (res.status !== 401) {
          first10All401 = false;
          unexpectedStatusDetail = `Requisição ${i} retornou status ${res.status} (esperado 401)`;
          break;
        }
      }

      if (first10All401) {
        const res11 = await request("/api/auth/login", {
          method: "POST",
          headers: { "X-Forwarded-For": rateLimitIp },
          body: { email: "email_qualquer@test.local", password: "SenhaIncorreta123!" },
        });

        request11Blocked429 = res11.status === 429 && res11.data?.error?.status === 429;
      }

      assert(
        first10All401 && request11Blocked429,
        "TEST 7.1",
        "Rate limiting de autenticação ativo: as primeiras 10 requisições retornam HTTP 401 e a 11ª é bloqueada com HTTP 429",
        `Primeiras 10 retornaram 401: ${first10All401}${unexpectedStatusDetail ? ` (${unexpectedStatusDetail})` : ""}, 11ª retornou 429: ${request11Blocked429}`,
      );
    }

    // ======================================================================
    // SUÍTE 8: INTEGRIDADE DE DADOS EXISTENTES E LIMPEZA
    // ======================================================================
    logSection("SUÍTE 8: INTEGRIDADE DE DADOS EXISTENTES E LIMPEZA");

    // 8.1 Verificação da integridade comprovando que dados preexistentes permaneceram intactos
    {
      const finalSnapshot = await capturePreexistingSnapshot();

      const initialUserMap = new Map(initialSnapshot.users.map((u) => [u.id, u]));
      const initialStudentMap = new Map(initialSnapshot.students.map((s) => [s.id, s]));
      const initialMonthMap = new Map(initialSnapshot.months.map((m) => [m.id, m]));
      const initialRecordMap = new Map(initialSnapshot.records.map((r) => [r.id, r]));

      const finalUserMap = new Map(finalSnapshot.users.map((u) => [u.id, u]));
      const finalStudentMap = new Map(finalSnapshot.students.map((s) => [s.id, s]));
      const finalMonthMap = new Map(finalSnapshot.months.map((m) => [m.id, m]));
      const finalRecordMap = new Map(finalSnapshot.records.map((r) => [r.id, r]));

      // 1. Cada registro preexistente deve existir no snapshot final com atributos 100% idênticos (incluindo fingerprint de credenciais)
      const usersIntact = initialSnapshot.users.every((initialU) => {
        const finalU = finalUserMap.get(initialU.id);
        return finalU && JSON.stringify(initialU) === JSON.stringify(finalU);
      });

      const studentsIntact = initialSnapshot.students.every((initialS) => {
        const finalS = finalStudentMap.get(initialS.id);
        return finalS && JSON.stringify(initialS) === JSON.stringify(finalS);
      });

      const monthsIntact = initialSnapshot.months.every((initialM) => {
        const finalM = finalMonthMap.get(initialM.id);
        return finalM && JSON.stringify(initialM) === JSON.stringify(finalM);
      });

      const recordsIntact = initialSnapshot.records.every((initialR) => {
        const finalR = finalRecordMap.get(initialR.id);
        return finalR && JSON.stringify(initialR) === JSON.stringify(finalR);
      });

      // 2. Nenhum registro preexistente pode ter sido removido
      const noPreexistingUsersDeleted =
        initialSnapshot.users.length === finalSnapshot.users.filter((u) => initialUserMap.has(u.id)).length;
      const noPreexistingStudentsDeleted =
        initialSnapshot.students.length === finalSnapshot.students.filter((s) => initialStudentMap.has(s.id)).length;
      const noPreexistingMonthsDeleted =
        initialSnapshot.months.length === finalSnapshot.months.filter((m) => initialMonthMap.has(m.id)).length;
      const noPreexistingRecordsDeleted =
        initialSnapshot.records.length === finalSnapshot.records.filter((r) => initialRecordMap.has(r.id)).length;

      const allPreexistingDataIntact =
        usersIntact &&
        studentsIntact &&
        monthsIntact &&
        recordsIntact &&
        noPreexistingUsersDeleted &&
        noPreexistingStudentsDeleted &&
        noPreexistingMonthsDeleted &&
        noPreexistingRecordsDeleted;

      assert(
        allPreexistingDataIntact,
        "TEST 8.1",
        "Integridade estrita: dados preexistentes (usuários com credenciais, alunos, meses e mensalidades) permaneceram 100% intactos",
        `Users: ${usersIntact}, Students: ${studentsIntact}, Months: ${monthsIntact}, Records: ${recordsIntact}`,
      );
    }
  } catch (err) {
    executionError = err;
    console.error(`\n${colors.red}${colors.bold}[ERRO CRÍTICO NA EXECUÇÃO] ${err.message}${colors.reset}`);
  } finally {
    // A limpeza de recursos e encerramento do pool SEMPRE são executados
    await runSafeCleanup();
  }

  // ======================================================================
  // RESUMO FINAL DA EXECUÇÃO
  // ======================================================================
  logSection("RESUMO FINAL DA EXECUÇÃO");
  console.log(`  Total de testes executados: ${passedCount + failedCount}`);
  console.log(`  ${colors.green}Testes aprovados:${colors.reset} ${passedCount}`);
  console.log(`  ${colors.red}Testes reprovados:${colors.reset} ${failedCount}`);

  if (executionError) {
    console.log(`\n${colors.red}${colors.bold}FALHA CRÍTICA PRELIMINAR:${colors.reset}`);
    console.log(`  - ${colors.red}${executionError.message}${colors.reset}`);
    process.exit(1);
  }

  if (failures.length > 0) {
    console.log(`\n${colors.red}${colors.bold}FALHAS DETECTADAS:${colors.reset}`);
    for (const f of failures) {
      console.log(`  - ${colors.red}${f}${colors.reset}`);
    }
    process.exit(1);
  } else {
    console.log(
      `\n${colors.green}${colors.bold}TODOS OS TESTES DE INTEGRAÇÃO FORAM EXECUTADOS COM SUCESSO!${colors.reset}\n`,
    );
    process.exit(0);
  }
}

runAuditSuite().catch((err) => {
  console.error("Erro no processo de testes:", err);
  process.exit(1);
});
