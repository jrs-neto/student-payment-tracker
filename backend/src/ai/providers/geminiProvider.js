import { GoogleGenAI } from "@google/genai";

let aiClient = null;
let currentApiKey = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    const error = new Error("GEMINI_API_KEY não foi configurada no ambiente.");
    error.status = 503;
    throw error;
  }

  const trimmedKey = apiKey.trim();

  if (!aiClient || currentApiKey !== trimmedKey) {
    aiClient = new GoogleGenAI({ apiKey: trimmedKey });
    currentApiKey = trimmedKey;
  }

  return aiClient;
}

const MODEL = "gemini-3.5-flash-lite";

// Configurações das requisições ao Gemini compatíveis com @google/genai 3.2.0
const REQUEST_OPTIONS = {
  timeout_ms: 15000,
  retries: {
    strategy: "attempt-count-backoff",
    maxRetries: 2,
    retryConnectionErrors: true,
    backoff: {
      initialInterval: 500,
      maxInterval: 1000,
      exponent: 2,
      maxElapsedTime: 1500,
    },
  },
  retry_codes: ["408", "429", "5XX"],
};

// Formata o histórico para o formato de entrada do Gemini
function buildConversationInput(prompt, history) {
  if (!Array.isArray(history)) {
    throw new Error("O histórico enviado ao Gemini é inválido.");
  }

  if (history.length === 0) {
    return prompt.trim();
  }

  const conversationHistory = history
    .map((message) => {
      const role = message.role === "user" ? "Usuário" : "Assistente";

      return `${role}: ${message.content}`;
    })
    .join("\n\n");

  return `
Considere o histórico abaixo como contexto da conversa.
Utilize as mensagens anteriores para compreender perguntas
que dependam de informações já discutidas.

HISTÓRICO DA CONVERSA:

${conversationHistory}

MENSAGEM ATUAL DO USUÁRIO:

${prompt.trim()}
`;
}

// Normaliza as respostas do Gemini para o contrato do assistente
function normalizeInteraction(interaction) {
  if (!interaction || typeof interaction !== "object" || typeof interaction.id !== "string" || !interaction.id.trim()) {
    throw new Error("O Gemini retornou uma interação inválida.");
  }

  const steps = interaction.steps ?? [];

  if (!Array.isArray(steps)) {
    throw new Error("O Gemini retornou etapas em formato inválido.");
  }

  const toolCalls = steps
    .filter((step) => step?.type === "function_call")
    .map((call) => {
      if (
        typeof call.id !== "string" ||
        !call.id.trim() ||
        typeof call.name !== "string" ||
        !call.name.trim() ||
        (call.arguments !== undefined &&
          (call.arguments === null || typeof call.arguments !== "object" || Array.isArray(call.arguments)))
      ) {
        throw new Error("O Gemini retornou uma chamada de ferramenta inválida.");
      }

      return {
        id: call.id,
        name: call.name,
        arguments: call.arguments ?? {},
      };
    });

  const text = interaction.output_text ?? "";

  if (typeof text !== "string") {
    throw new Error("O Gemini retornou um texto em formato inválido.");
  }

  return {
    conversationId: interaction.id,
    text,
    toolCalls,
  };
}

// Inicia uma interação com o Gemini
export async function startConversation({ prompt, history = [], tools }) {
  const ai = getClient();
  const input = buildConversationInput(prompt, history);

  const interaction = await ai.interactions.create(
    {
      model: MODEL,
      input,
      tools,
    },
    REQUEST_OPTIONS,
  );

  return normalizeInteraction(interaction);
}

// Continua a interação após a execução das ferramentas
export async function continueConversation({ conversationId, toolResults, tools }) {
  const ai = getClient();
  const functionResults = toolResults.map((item) => ({
    type: "function_result",
    name: item.name,
    call_id: item.callId,
    result: [
      {
        type: "text",
        text: JSON.stringify(item.result),
      },
    ],
  }));

  const interaction = await ai.interactions.create(
    {
      model: MODEL,
      previous_interaction_id: conversationId,
      input: functionResults,
      tools,
    },
    REQUEST_OPTIONS,
  );

  return normalizeInteraction(interaction);
}
