const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_CONTENT_LENGTH = 4000;
const MAX_AGGREGATE_HISTORY_LENGTH = 80000;
const MAX_TOOL_CALLS_PER_ROUND = 5;
const MAX_TOOL_CALL_ID_LENGTH = 128;
const MAX_TOOL_NAME_LENGTH = 64;
const MAX_TOOL_ARGUMENTS_LENGTH = 2000;
const MAX_TOOL_RESULT_STRING_LENGTH = 50000;

function validateHistory(history) {
  if (!Array.isArray(history)) {
    throw new Error("O histórico da conversa é inválido.");
  }

  if (history.length > MAX_HISTORY_MESSAGES) {
    throw new Error(`O histórico excede o limite máximo de ${MAX_HISTORY_MESSAGES} mensagens.`);
  }

  let aggregateLength = 0;

  for (const message of history) {
    if (
      !message ||
      typeof message !== "object" ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      throw new Error("O histórico contém uma mensagem inválida.");
    }

    if (message.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      throw new Error(`Uma mensagem do histórico ultrapassa o limite de ${MAX_MESSAGE_CONTENT_LENGTH} caracteres.`);
    }

    aggregateLength += message.content.length;
  }

  if (aggregateLength > MAX_AGGREGATE_HISTORY_LENGTH) {
    throw new Error(`O histórico acumulado ultrapassa o limite máximo de ${MAX_AGGREGATE_HISTORY_LENGTH} caracteres.`);
  }

  return history;
}

function validateProviderResponse(response) {
  if (
    !response ||
    typeof response !== "object" ||
    !Array.isArray(response.toolCalls) ||
    typeof response.text !== "string"
  ) {
    throw new Error("O provedor retornou uma resposta inválida.");
  }

  if (response.toolCalls.length > MAX_TOOL_CALLS_PER_ROUND) {
    throw new Error(`O provedor excedeu o limite de ${MAX_TOOL_CALLS_PER_ROUND} chamadas de ferramentas por rodada.`);
  }

  for (const call of response.toolCalls) {
    if (
      !call ||
      typeof call !== "object" ||
      typeof call.id !== "string" ||
      !call.id.trim() ||
      call.id.trim().length > MAX_TOOL_CALL_ID_LENGTH ||
      typeof call.name !== "string" ||
      !call.name.trim() ||
      call.name.trim().length > MAX_TOOL_NAME_LENGTH ||
      (call.arguments !== undefined &&
        (call.arguments === null || typeof call.arguments !== "object" || Array.isArray(call.arguments)))
    ) {
      throw new Error("O provedor retornou uma chamada de ferramenta inválida.");
    }

    try {
      const argsLength = JSON.stringify(call.arguments ?? {}).length;

      if (argsLength > MAX_TOOL_ARGUMENTS_LENGTH) {
        throw new Error("Os argumentos da chamada de ferramenta excedem o limite de tamanho permitido.");
      }
    } catch (serializeError) {
      throw new Error(
        serializeError.message.includes("excedem o limite")
          ? serializeError.message
          : "Os argumentos da ferramenta não puderam ser serializados.",
      );
    }
  }

  const callIds = response.toolCalls.map((call) => call.id);

  if (new Set(callIds).size !== callIds.length) {
    throw new Error("O provedor retornou chamadas de ferramenta duplicadas.");
  }

  return response;
}

export async function runAssistant({ provider, prompt, history = [], toolDeclarations, executeTool, userId }) {
  // Valida o usuário autenticado.
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("Usuário inválido.");
  }

  // Valida o provedor.
  if (
    !provider ||
    typeof provider.startConversation !== "function" ||
    typeof provider.continueConversation !== "function"
  ) {
    throw new Error("Provedor de IA inválido ou incompleto.");
  }

  // Valida a mensagem.
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("A mensagem enviada ao assistente é inválida.");
  }

  // Valida o histórico.
  validateHistory(history);

  // Valida as ferramentas.
  if (!Array.isArray(toolDeclarations)) {
    throw new Error("As declarações de ferramentas são inválidas.");
  }

  if (typeof executeTool !== "function") {
    throw new Error("O executor de ferramentas é inválido.");
  }

  // Inicia a conversa com o provedor.
  let response = validateProviderResponse(
    await provider.startConversation({
      prompt: prompt.trim(),
      history,
      tools: toolDeclarations,
    }),
  );

  // Limite de segurança para evitar ciclos infinitos.
  const maxToolRounds = 5;

  for (let round = 0; round < maxToolRounds; round++) {
    // Se não houver ferramentas solicitadas, retorna a resposta.
    if (response.toolCalls.length === 0) {
      return response.text;
    }

    // Valida o identificador da conversa.
    if (typeof response.conversationId !== "string" || !response.conversationId.trim()) {
      throw new Error("O provedor não retornou um identificador de conversa válido.");
    }

    // Executa as ferramentas autorizadas.
    const toolResults = await Promise.all(
      response.toolCalls.map(async (call) => {
        try {
          // O userId vem exclusivamente do contexto autenticado.
          let result = await executeTool(call.name, call.arguments ?? {}, userId);

          // Valida se o resultado gerado pela ferramenta possui tamanho aceitável.
          const serializedResult = JSON.stringify(result);

          if (serializedResult.length > MAX_TOOL_RESULT_STRING_LENGTH) {
            console.warn(
              `Resultado da ferramenta ${call.name} excedeu o limite máximo (${serializedResult.length} caracteres). Retornando aviso seguro.`,
            );

            result = {
              error: "O volume de dados retornado pela consulta excedeu o limite seguro.",
            };
          }

          return {
            callId: call.id,
            name: call.name,
            result,
          };
        } catch (error) {
          console.error(`Erro ao executar ferramenta ${call.name}:`, error);

          return {
            callId: call.id,
            name: call.name,
            result: {
              error: "Não foi possível realizar essa consulta.",
            },
          };
        }
      }),
    );

    // Continua a interação com os resultados das ferramentas.
    response = validateProviderResponse(
      await provider.continueConversation({
        conversationId: response.conversationId,
        toolResults,
        tools: toolDeclarations,
      }),
    );
  }

  // Permite retornar a resposta final recebida após a quinta rodada.
  if (response.toolCalls.length === 0) {
    return response.text;
  }

  throw new Error("O limite de execuções de ferramentas foi atingido.");
}
