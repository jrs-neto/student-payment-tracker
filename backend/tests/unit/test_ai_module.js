import { executePaymentTool } from "../../src/ai/tools/paymentTools.js";
import { executeStudentTool } from "../../src/ai/tools/studentTools.js";
import { executeTool } from "../../src/ai/tools/toolRegistry.js";
import { runAssistant } from "../../src/ai/assistantEngine.js";
import { createConversation, getConversation, addConversationMessage } from "../../src/ai/conversationStore.js";
import { createAssistantService } from "../../src/services/assistantService.js";
import { monthlyModel } from "../../src/models/monthlyModel.js";
import { monthlyService } from "../../src/services/monthlyService.js";
import { studentModel } from "../../src/models/studentModel.js";

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.error(`  [FAIL] ${message}`);
  }
}

async function assertThrowsAsync(fn, expectedSubstring, message) {
  try {
    await fn();
    failed++;
    failures.push(`${message} (Deveria ter lançado erro, mas executou com sucesso)`);
    console.error(`  [FAIL] ${message} (nenhum erro lançado)`);
  } catch (err) {
    if (expectedSubstring && !String(err?.message || "").includes(expectedSubstring)) {
      failed++;
      failures.push(`${message} (Mensagem esperada "${expectedSubstring}" não encontrada em "${err?.message}")`);
      console.error(`  [FAIL] ${message} - Erro: ${err?.message}`);
    } else {
      passed++;
      console.log(`  [PASS] ${message}`);
    }
  }
}

console.log("\n=======================================================");
console.log("INICIANDO SUÍTE DE TESTES UNITÁRIOS DO MÓDULO DE IA");
console.log("=======================================================\n");

// ----------------------------------------------------------------------
// 1. MAPEAMENTO DE STATUS E CÁLCULOS EM paymentTools.js
// ----------------------------------------------------------------------
console.log("1. Mapeamento de status e cálculos em paymentTools.js");

const originalFindMonth = monthlyModel.findMonthByYearAndMonth;
const originalGetMonthRecords = monthlyService.getMonthRecords;

monthlyModel.findMonthByYearAndMonth = async (year, month, userId) => {
  return { id: 101, year, month, user_id: userId };
};

monthlyService.getMonthRecords = async (monthId, userId) => {
  return {
    month: { id: monthId, year: 2026, month: 5 },
    records: [
      { student_name: "Aluno 1", amount: "150.00", due_date: "2026-05-10", status: "paid" },
      { student_name: "Aluno 2", amount: "200.00", due_date: "2026-05-10", status: "paid" },
      { student_name: "Aluno 3", amount: "100.00", due_date: "2026-05-15", status: "pending" },
      { student_name: "Aluno 4", amount: "300.00", due_date: "2026-05-01", status: "overdue" },
    ],
  };
};

try {
  // 1.1 Pago -> paid
  const resPago = await executePaymentTool("getMonthlyPaymentsByStatus", { year: 2026, month: 5, status: "Pago" }, 1);
  assert(
    resPago.found === true &&
      resPago.total_records === 2 &&
      resPago.total_amount === "350.00" &&
      resPago.records.every((r) => r.status === "paid"),
    "Status 'Pago' mapeado para 'paid' com totais e quantidade corretos",
  );

  // 1.2 Pendente -> pending
  const resPendente = await executePaymentTool(
    "getMonthlyPaymentsByStatus",
    { year: 2026, month: 5, status: "Pendente" },
    1,
  );
  assert(
    resPendente.found === true &&
      resPendente.total_records === 1 &&
      resPendente.total_amount === "100.00" &&
      resPendente.records[0].status === "pending",
    "Status 'Pendente' mapeado para 'pending' com totais corretos",
  );

  // 1.3 Atrasado -> overdue
  const resAtrasado = await executePaymentTool(
    "getMonthlyPaymentsByStatus",
    { year: 2026, month: 5, status: "Atrasado" },
    1,
  );
  assert(
    resAtrasado.found === true &&
      resAtrasado.total_records === 1 &&
      resAtrasado.total_amount === "300.00" &&
      resAtrasado.records[0].status === "overdue",
    "Status 'Atrasado' mapeado para 'overdue' com totais corretos",
  );

  // 1.4 Todos -> todos os registros
  const resTodos = await executePaymentTool("getMonthlyPaymentsByStatus", { year: 2026, month: 5, status: "Todos" }, 1);
  assert(
    resTodos.found === true && resTodos.total_records === 4 && resTodos.total_amount === "750.00",
    "Status 'Todos' retorna todos os registros e soma correta",
  );

  // 1.5 Status inválido
  await assertThrowsAsync(
    () => executePaymentTool("getMonthlyPaymentsByStatus", { year: 2026, month: 5, status: "Inexistente" }, 1),
    "Status de pagamento inválido.",
    "Rejeita status inválido com mensagem apropriada",
  );
} finally {
  monthlyModel.findMonthByYearAndMonth = originalFindMonth;
  monthlyService.getMonthRecords = originalGetMonthRecords;
}

// ----------------------------------------------------------------------
// 2. VALIDAÇÃO ESTRITA DE ARGUMENTOS
// ----------------------------------------------------------------------
console.log("\n2. Validação estrita de argumentos das ferramentas");

// 2.1 getStudentCount com argumentos inesperados
await assertThrowsAsync(
  () => executeStudentTool("getStudentCount", 1, { extraArg: "invalido" }),
  "não aceita parâmetros",
  "getStudentCount rejeita parâmetros adicionais",
);

// 2.2 getMonthlyFinancialSummary com argumentos inesperados
await assertThrowsAsync(
  () => executePaymentTool("getMonthlyFinancialSummary", { year: 2026, month: 5, inject: true }, 1),
  "Parâmetros inesperados",
  "getMonthlyFinancialSummary rejeita chaves adicionais",
);

// 2.3 getMonthlyPaymentsByStatus com argumentos inesperados
await assertThrowsAsync(
  () => executePaymentTool("getMonthlyPaymentsByStatus", { year: 2026, month: 5, status: "Pago", extra: 123 }, 1),
  "Parâmetros inesperados",
  "getMonthlyPaymentsByStatus rejeita chaves adicionais",
);

// 2.4 Ferramenta não autorizada
await assertThrowsAsync(
  () => executeTool("ferramentaInexistente", {}, 1),
  "Ferramenta não autorizada",
  "executeTool rejeita nome de ferramenta não autorizada",
);

// ----------------------------------------------------------------------
// 3. VALIDAÇÃO DE USER_ID E SEGURANÇA MULTIUSUÁRIO
// ----------------------------------------------------------------------
console.log("\n3. Validação de userId e proteção multiusuário");

for (const invalidId of [0, -1, null, undefined, "1", NaN, 1.5]) {
  await assertThrowsAsync(
    () => executeTool("getStudentCount", {}, invalidId),
    "Usuário inválido",
    `executeTool rejeita userId inválido (${invalidId})`,
  );
}

for (const invalidId of [0, -1, null, undefined, "1"]) {
  await assertThrowsAsync(
    () => executeStudentTool("getStudentCount", invalidId, {}),
    "Usuário inválido",
    `executeStudentTool rejeita userId inválido (${invalidId})`,
  );
}

for (const invalidId of [0, -1, null, undefined, "1"]) {
  await assertThrowsAsync(
    () => executePaymentTool("getMonthlyFinancialSummary", { year: 2026, month: 5 }, invalidId),
    "Usuário inválido",
    `executePaymentTool rejeita userId inválido (${invalidId})`,
  );
}

// ----------------------------------------------------------------------
// 4. LIMITES DE CONTEXTO E HISTÓRICO EM assistantEngine.js
// ----------------------------------------------------------------------
console.log("\n4. Limites de contexto e histórico em assistantEngine.js");

const mockProvider = {
  startConversation: async () => ({
    conversationId: "conv-123",
    text: "Resposta simulada",
    toolCalls: [],
  }),
  continueConversation: async () => ({
    conversationId: "conv-123",
    text: "Resposta continuada",
    toolCalls: [],
  }),
};

// 4.1 Histórico com mais de 20 mensagens
const oversizedHistory = Array.from({ length: 21 }, (_, i) => ({
  role: i % 2 === 0 ? "user" : "assistant",
  content: `Mensagem ${i}`,
}));

await assertThrowsAsync(
  () =>
    runAssistant({
      provider: mockProvider,
      prompt: "Olá",
      history: oversizedHistory,
      toolDeclarations: [],
      executeTool: async () => {},
      userId: 1,
    }),
  "excede o limite máximo de 20 mensagens",
  "assistantEngine rejeita histórico com mais de 20 mensagens",
);

// 4.2 Mensagem individual no histórico ultrapassando 4000 caracteres
const hugeMessageHistory = [{ role: "user", content: "A".repeat(4001) }];

await assertThrowsAsync(
  () =>
    runAssistant({
      provider: mockProvider,
      prompt: "Olá",
      history: hugeMessageHistory,
      toolDeclarations: [],
      executeTool: async () => {},
      userId: 1,
    }),
  "ultrapassa o limite de 4000 caracteres",
  "assistantEngine rejeita mensagem individual do histórico com mais de 4000 caracteres",
);

// 4.3 Histórico no limite máximo permitido
const maximumHistory = Array.from({ length: 20 }, (_, i) => ({
  role: i % 2 === 0 ? "user" : "assistant",
  content: "A".repeat(4000),
}));

const maximumHistoryResult = await runAssistant({
  provider: mockProvider,
  prompt: "Olá",
  history: maximumHistory,
  toolDeclarations: [],
  executeTool: async () => {},
  userId: 1,
});

assert(
  maximumHistoryResult === "Resposta simulada",
  "assistantEngine aceita histórico com 20 mensagens de 4000 caracteres",
);

// 4.4 Provedor retornando mais de 5 chamadas de ferramentas por rodada
const providerTooManyTools = {
  startConversation: async () => ({
    conversationId: "conv-123",
    text: "",
    toolCalls: Array.from({ length: 6 }, (_, i) => ({
      id: `call-${i}`,
      name: "getStudentCount",
      arguments: {},
    })),
  }),
  continueConversation: async () => ({ conversationId: "conv-123", text: "", toolCalls: [] }),
};

await assertThrowsAsync(
  () =>
    runAssistant({
      provider: providerTooManyTools,
      prompt: "Olá",
      history: [],
      toolDeclarations: [],
      executeTool: async () => {},
      userId: 1,
    }),
  "excedeu o limite de 5 chamadas de ferramentas",
  "assistantEngine rejeita mais de 5 chamadas de ferramentas por rodada",
);

// 4.5 Provedor retornando tool calls com IDs duplicados
const providerDuplicateToolIds = {
  startConversation: async () => ({
    conversationId: "conv-123",
    text: "",
    toolCalls: [
      { id: "call-1", name: "getStudentCount", arguments: {} },
      { id: "call-1", name: "getStudentCount", arguments: {} },
    ],
  }),
  continueConversation: async () => ({ conversationId: "conv-123", text: "", toolCalls: [] }),
};

await assertThrowsAsync(
  () =>
    runAssistant({
      provider: providerDuplicateToolIds,
      prompt: "Olá",
      history: [],
      toolDeclarations: [],
      executeTool: async () => {},
      userId: 1,
    }),
  "chamadas de ferramenta duplicadas",
  "assistantEngine rejeita chamadas de ferramenta com IDs duplicados",
);

// 4.6 Provedor retornando argumentos com tamanho excessivo
const providerOversizedArgs = {
  startConversation: async () => ({
    conversationId: "conv-123",
    text: "",
    toolCalls: [{ id: "call-1", name: "getStudentCount", arguments: { payload: "X".repeat(2500) } }],
  }),
  continueConversation: async () => ({ conversationId: "conv-123", text: "", toolCalls: [] }),
};

await assertThrowsAsync(
  () =>
    runAssistant({
      provider: providerOversizedArgs,
      prompt: "Olá",
      history: [],
      toolDeclarations: [],
      executeTool: async () => {},
      userId: 1,
    }),
  "excedem o limite de tamanho permitido",
  "assistantEngine rejeita argumentos de ferramentas maiores que 2000 caracteres",
);

// 4.7 Resultado de ferramenta com tamanho excessivo é tratado de forma segura
let toolResultSafeHandling = false;
const providerOversizedResult = {
  startConversation: async () => ({
    conversationId: "conv-123",
    text: "",
    toolCalls: [{ id: "call-1", name: "getStudentCount", arguments: {} }],
  }),
  continueConversation: async ({ toolResults }) => {
    if (toolResults[0]?.result?.error?.includes("excedeu o limite seguro")) {
      toolResultSafeHandling = true;
    }
    return { conversationId: "conv-123", text: "Tratamento concluído com segurança", toolCalls: [] };
  },
};

const resSafe = await runAssistant({
  provider: providerOversizedResult,
  prompt: "Olá",
  history: [],
  toolDeclarations: [],
  executeTool: async () => ({ hugeData: "Z".repeat(55000) }),
  userId: 1,
});

assert(
  toolResultSafeHandling && resSafe === "Tratamento concluído com segurança",
  "Resultado de ferramenta excessivamente grande é substituído por aviso seguro",
);

// 4.8 Resposta final recebida após a quinta rodada de ferramentas
let finalResponseRounds = 0;

const providerFinalAfterFifthRound = {
  startConversation: async () => ({
    conversationId: "conv-final",
    text: "",
    toolCalls: [{ id: "call-0", name: "getStudentCount", arguments: {} }],
  }),

  continueConversation: async () => {
    finalResponseRounds++;

    if (finalResponseRounds === 5) {
      return {
        conversationId: "conv-final",
        text: "Resposta final após a quinta rodada",
        toolCalls: [],
      };
    }

    return {
      conversationId: "conv-final",
      text: "",
      toolCalls: [
        {
          id: `call-${finalResponseRounds}`,
          name: "getStudentCount",
          arguments: {},
        },
      ],
    };
  },
};

const finalResponseResult = await runAssistant({
  provider: providerFinalAfterFifthRound,
  prompt: "Consulte os alunos",
  history: [],
  toolDeclarations: [],
  executeTool: async () => ({ totalStudents: 8 }),
  userId: 1,
});

assert(
  finalResponseRounds === 5 && finalResponseResult === "Resposta final após a quinta rodada",
  "assistantEngine aceita resposta final recebida após a quinta rodada",
);

// 4.9 Rejeição de ferramentas solicitadas além do limite de cinco rodadas
let exceededLimitRounds = 0;

const providerExceedingToolLimit = {
  startConversation: async () => ({
    conversationId: "conv-limit",
    text: "",
    toolCalls: [{ id: "limit-0", name: "getStudentCount", arguments: {} }],
  }),

  continueConversation: async () => {
    exceededLimitRounds++;

    return {
      conversationId: "conv-limit",
      text: "",
      toolCalls: [
        {
          id: `limit-${exceededLimitRounds}`,
          name: "getStudentCount",
          arguments: {},
        },
      ],
    };
  },
};

await assertThrowsAsync(
  () =>
    runAssistant({
      provider: providerExceedingToolLimit,
      prompt: "Consulte os alunos",
      history: [],
      toolDeclarations: [],
      executeTool: async () => ({ totalStudents: 8 }),
      userId: 1,
    }),
  "O limite de execuções de ferramentas foi atingido.",
  "assistantEngine rejeita novas chamadas após cinco rodadas de ferramentas",
);

assert(exceededLimitRounds === 5, "assistantEngine não executa uma sexta rodada de ferramentas");

// ----------------------------------------------------------------------
// 5. ISOLAMENTO E EXPIRAÇÃO DE CONVERSAS EM conversationStore.js
// ----------------------------------------------------------------------
console.log("\n5. Isolamento e expiração em conversationStore.js");

// 5.1 Usuário 1 cria conversa
const convUser1 = createConversation(1);
assert(typeof convUser1.conversationId === "string", "Criação de conversa para Usuário 1 bem-sucedida");

// 5.2 Usuário 2 não consegue acessar conversa do Usuário 1
const convReadByUser2 = getConversation(convUser1.conversationId, 2);
assert(convReadByUser2 === null, "Usuário 2 não consegue ler conversa pertencente ao Usuário 1 (retorna null)");

// 5.3 Usuário 2 não consegue adicionar mensagem à conversa do Usuário 1
await assertThrowsAsync(
  async () => addConversationMessage(convUser1.conversationId, "user", "Tentativa de injeção", 2),
  "Conversa não encontrada ou expirada",
  "Usuário 2 impedido de adicionar mensagem na conversa do Usuário 1",
);

// 5.4 Limite de mensagens mantido em 20
for (let i = 1; i <= 25; i++) {
  addConversationMessage(convUser1.conversationId, "user", `Msg ${i}`, 1);
}
const convUpdated = getConversation(convUser1.conversationId, 1);
assert(
  convUpdated.messages.length === 20 && convUpdated.messages[0].content === "Msg 6",
  "Histórico no conversationStore preserva estritamente as últimas 20 mensagens",
);

// ----------------------------------------------------------------------
// 6. TRATAMENTO DE FALHAS EM assistantService.js
// ----------------------------------------------------------------------
console.log("\n6. Tratamento de erros e isolamento de falhas em assistantService.js");

// 6.1 Erro de timeout do provedor mapeado para HTTP 504
const serviceWithTimeout = createAssistantService(async () => {
  const err = new Error("The request timed out after 15000ms");
  err.name = "RequestTimeoutError";
  throw err;
});

await assertThrowsAsync(
  () => serviceWithTimeout.sendMessage("Olá", null, 1),
  "O serviço de IA demorou demais para responder.",
  "Timeout do provedor é mapeado para HTTP 504 com mensagem amigável",
);

// 6.2 Erro 503/429 do provedor mapeado para HTTP 503
const serviceWith503 = createAssistantService(async () => {
  const err = new Error("Model is overloaded");
  err.status = 503;
  throw err;
});

await assertThrowsAsync(
  () => serviceWith503.sendMessage("Olá", null, 1),
  "O serviço de IA está temporariamente indisponível.",
  "Erro 503 do provedor é mapeado para HTTP 503 com mensagem amigável",
);

// 6.3 Erro genérico do provedor mapeado para HTTP 502
const serviceWith500 = createAssistantService(async () => {
  throw new Error("Internal upstream failure");
});

await assertThrowsAsync(
  () => serviceWith500.sendMessage("Olá", null, 1),
  "Não foi possível estabelecer comunicação com o serviço de IA.",
  "Erro genérico do provedor é mapeado para HTTP 502",
);

// 6.4 Erro no armazenamento da conversa (NÃO deve ser transformado em 502)
let serviceStorageErrorCaught = false;
let serviceStorageStatus = null;

const serviceWithStorageBug = createAssistantService(async () => "Resposta válida do Gemini");

// Força uma falha no armazenamento passando um identificador adulterado ou corrompendo a adição
try {
  // Chamada com userId inválido no store ou simulando falha de gravação
  await serviceWithStorageBug.sendMessage("Olá", "id-inexistente-ou-invalido", 1);
} catch (err) {
  serviceStorageErrorCaught = true;
  serviceStorageStatus = err.status;
}

assert(
  serviceStorageErrorCaught && serviceStorageStatus === 404,
  "Conversa inexistente retorna 404 (não é transformada em erro do Gemini)",
);

// ----------------------------------------------------------------------
// RESUMO DOS TESTES
// ----------------------------------------------------------------------
console.log("\n=======================================================");
console.log(`TOTAL DE TESTES: ${passed + failed}`);
console.log(`TESTES APROVADOS: ${passed}`);
console.log(`TESTES REPROVADOS: ${failed}`);
console.log("=======================================================\n");

if (failed > 0) {
  console.error("FALHAS ENCONTRADAS:");
  for (const f of failures) {
    console.error(` - ${f}`);
  }
  process.exit(1);
} else {
  console.log("TODOS OS TESTES UNITÁRIOS FORAM APROVADOS COM SUCESSO!\n");
  process.exit(0);
}
