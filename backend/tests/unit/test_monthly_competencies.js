import test from "node:test";
import assert from "node:assert/strict";
import pool from "../../src/config/database.js";
import { monthlyService } from "../../src/services/monthlyService.js";
import { monthlyModel } from "../../src/models/monthlyModel.js";
import { monthlyController } from "../../src/controllers/monthlyController.js";
import { readOnlyDemoMiddleware } from "../../src/middlewares/readOnlyDemoMiddleware.js";
import monthlyRoutes from "../../src/routes/monthlyRoutes.js";

test("1. Criação automática do mês atual quando ainda não existe na listagem", async () => {
  const originalEnsure = monthlyModel.ensureMonthExists;
  const originalFindAll = monthlyModel.findAllMonths;

  let ensureCalledWith = null;
  monthlyModel.ensureMonthExists = async (year, month, userId) => {
    ensureCalledWith = { year, month, userId };
    return { id: 10, year, month, user_id: userId, created_at: new Date() };
  };

  monthlyModel.findAllMonths = async (userId) => {
    return [{ id: 10, year: ensureCalledWith.year, month: ensureCalledWith.month, created_at: new Date() }];
  };

  try {
    const months = await monthlyService.listMonths(42, { isDemo: false });
    assert.ok(ensureCalledWith, "ensureMonthExists deve ter sido chamado");
    assert.equal(ensureCalledWith.userId, 42);
    assert.equal(typeof ensureCalledWith.year, "number");
    assert.ok(ensureCalledWith.month >= 1 && ensureCalledWith.month <= 12);
    assert.equal(months.length, 1);
  } finally {
    monthlyModel.ensureMonthExists = originalEnsure;
    monthlyModel.findAllMonths = originalFindAll;
  }
});

test("2. Idempotência em chamadas repetidas de listMonths", async () => {
  const originalEnsure = monthlyModel.ensureMonthExists;
  const originalFindAll = monthlyModel.findAllMonths;

  let ensureCount = 0;
  monthlyModel.ensureMonthExists = async (year, month, userId) => {
    ensureCount += 1;
    // Em chamadas subsequentes, o banco com ON CONFLICT DO NOTHING retornaria null (já existe)
    return ensureCount === 1 ? { id: 10, year, month, user_id: userId } : null;
  };

  monthlyModel.findAllMonths = async (userId) => {
    return [{ id: 10, year: 2026, month: 11, created_at: new Date() }];
  };

  try {
    const call1 = await monthlyService.listMonths(42, { isDemo: false });
    const call2 = await monthlyService.listMonths(42, { isDemo: false });

    assert.equal(ensureCount, 2, "ensureMonthExists deve ser chamado com ON CONFLICT");
    assert.deepEqual(call1, call2, "O resultado de ambas as chamadas deve ser idêntico");
  } finally {
    monthlyModel.ensureMonthExists = originalEnsure;
    monthlyModel.findAllMonths = originalFindAll;
  }
});

test("3. Segurança contra duplicação em chamadas simultâneas (ON CONFLICT DO NOTHING)", async () => {
  const originalEnsure = monthlyModel.ensureMonthExists;
  const originalFindAll = monthlyModel.findAllMonths;

  let executionOrder = [];
  monthlyModel.ensureMonthExists = async (year, month, userId) => {
    executionOrder.push(`ensure-${userId}`);
    // Simula resolução atômica no banco sem lançar erro de colisão
    return null;
  };

  monthlyModel.findAllMonths = async (userId) => {
    executionOrder.push(`find-${userId}`);
    return [{ id: 10, year: 2026, month: 11 }];
  };

  try {
    const [res1, res2] = await Promise.all([
      monthlyService.listMonths(42, { isDemo: false }),
      monthlyService.listMonths(42, { isDemo: false }),
    ]);

    assert.equal(res1.length, 1);
    assert.equal(res2.length, 1);
    assert.equal(executionOrder.filter((item) => item === "ensure-42").length, 2);
  } finally {
    monthlyModel.ensureMonthExists = originalEnsure;
    monthlyModel.findAllMonths = originalFindAll;
  }
});

test("4. Listagem sem alteração no banco para conta demo (isDemo: true)", async () => {
  const originalEnsure = monthlyModel.ensureMonthExists;
  const originalFindAll = monthlyModel.findAllMonths;

  let ensureCalled = false;
  monthlyModel.ensureMonthExists = async () => {
    ensureCalled = true;
    throw new Error("Não deve escrever no banco para contas de demonstração");
  };

  monthlyModel.findAllMonths = async (userId) => {
    return [{ id: 1, year: 2026, month: 10 }, { id: 2, year: 2026, month: 11 }];
  };

  try {
    const months = await monthlyService.listMonths(99, { isDemo: true });
    assert.equal(ensureCalled, false, "ensureMonthExists NÃO pode ser chamado para demo");
    assert.equal(months.length, 2);
  } finally {
    monthlyModel.ensureMonthExists = originalEnsure;
    monthlyModel.findAllMonths = originalFindAll;
  }
});

test("5. Criação manual de competência válida", async () => {
  const originalCreate = monthlyModel.createMonth;

  let createdWith = null;
  monthlyModel.createMonth = async ({ year, month }, userId) => {
    createdWith = { year, month, userId };
    return { id: 15, year, month, user_id: userId, created_at: new Date() };
  };

  try {
    const result = await monthlyService.createMonth({ year: 2026, month: 1 }, 7);
    assert.equal(createdWith.year, 2026);
    assert.equal(createdWith.month, 1);
    assert.equal(createdWith.userId, 7);
    assert.equal(result.id, 15);
  } finally {
    monthlyModel.createMonth = originalCreate;
  }
});

test("6. Rejeição de ano inválido na criação manual", async () => {
  const invalidYears = [1999, 2101, "2026", 2026.5, null, undefined, NaN];

  for (const year of invalidYears) {
    await assert.rejects(
      monthlyService.createMonth({ year, month: 5 }, 1),
      (err) => err.status === 400 && err.message.includes("year"),
      `Deveria rejeitar ano inválido: ${year}`
    );
  }
});

test("7. Rejeição de mês inválido na criação manual", async () => {
  const invalidMonths = [0, 13, -1, "5", 5.5, null, undefined, NaN];

  for (const month of invalidMonths) {
    await assert.rejects(
      monthlyService.createMonth({ year: 2026, month }, 1),
      (err) => err.status === 400 && err.message.includes("month"),
      `Deveria rejeitar mês inválido: ${month}`
    );
  }
});

test("8. Retorno HTTP 409 para competência duplicada (uk_user_year_month)", async () => {
  const originalCreate = monthlyModel.createMonth;

  monthlyModel.createMonth = async () => {
    const dbError = new Error("duplicate key value violates unique constraint");
    dbError.code = "23505";
    dbError.constraint = "uk_user_year_month";
    throw dbError;
  };

  try {
    await assert.rejects(
      monthlyService.createMonth({ year: 2026, month: 1 }, 1),
      (err) => err.status === 409 && err.message === "Este mês de referência já existe."
    );
  } finally {
    monthlyModel.createMonth = originalCreate;
  }
});

test("9. Isolamento entre usuários: dois usuários podem criar a mesma competência", async () => {
  const originalCreate = monthlyModel.createMonth;
  const store = new Map();

  monthlyModel.createMonth = async ({ year, month }, userId) => {
    const key = `${userId}-${year}-${month}`;
    if (store.has(key)) {
      const err = new Error("unique violation");
      err.code = "23505";
      err.constraint = "uk_user_year_month";
      throw err;
    }
    const entry = { id: store.size + 1, year, month, user_id: userId };
    store.set(key, entry);
    return entry;
  };

  try {
    const user1Month = await monthlyService.createMonth({ year: 2026, month: 3 }, 101);
    const user2Month = await monthlyService.createMonth({ year: 2026, month: 3 }, 202);

    assert.equal(user1Month.user_id, 101);
    assert.equal(user2Month.user_id, 202);
    assert.equal(user1Month.month, user2Month.month);
    assert.equal(user1Month.year, user2Month.year);

    // Duplicata para o mesmo usuário deve ser rejeitada com 409
    await assert.rejects(
      monthlyService.createMonth({ year: 2026, month: 3 }, 101),
      (err) => err.status === 409
    );
  } finally {
    monthlyModel.createMonth = originalCreate;
  }
});

test("10. Bloqueio da criação manual para conta demo (readOnlyDemoMiddleware)", () => {
  const req = { user: { id: 99, isDemo: true } };
  let statusCode = null;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      body = data;
      return this;
    },
  };

  let nextCalled = false;
  readOnlyDemoMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false, "next() não deve ser chamado para conta demo");
  assert.equal(statusCode, 403);
  assert.match(body.error.message, /somente leitura/i);

  // Confirma que a rota POST /months possui o readOnlyDemoMiddleware na stack
  const postMonthsLayer = monthlyRoutes.stack.find(
    (layer) => layer.route && layer.route.path === "/months" && layer.route.methods.post
  );
  assert.ok(postMonthsLayer, "Rota POST /months deve existir em monthlyRoutes");
  assert.ok(
    postMonthsLayer.route.stack.some((h) => h.handle === readOnlyDemoMiddleware),
    "POST /months deve utilizar readOnlyDemoMiddleware"
  );
});

test("11. Garantia de que a criação manual não gera registros de mensalidades", async () => {
  const originalCreateMonth = monthlyModel.createMonth;
  const originalCreateRecord = monthlyModel.createRecordWithClient;

  let recordCreated = false;
  monthlyModel.createMonth = async ({ year, month }, userId) => ({
    id: 999,
    year,
    month,
    user_id: userId,
  });

  monthlyModel.createRecordWithClient = async () => {
    recordCreated = true;
  };

  try {
    const month = await monthlyService.createMonth({ year: 2026, month: 6 }, 1);
    assert.equal(month.id, 999);
    assert.equal(recordCreated, false, "Nenhum registro de mensalidade deve ser criado");
  } finally {
    monthlyModel.createMonth = originalCreateMonth;
    monthlyModel.createRecordWithClient = originalCreateRecord;
  }
});

test.after(async () => {
  try {
    await pool.end();
  } catch {}
  setTimeout(() => process.exit(0), 50);
});
