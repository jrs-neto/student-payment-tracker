function validateHistory(history) {
  if (!Array.isArray(history)) {
    throw new Error("O histórico da conversa é inválido.");
  }

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

  for (const call of response.toolCalls) {
    if (
      !call ||
      typeof call !== "object" ||
      typeof call.id !== "string" ||
      !call.id.trim() ||
      typeof call.name !== "string" ||
      !call.name.trim() ||
      (call.arguments !== undefined &&
        (call.arguments === null || typeof call.arguments !== "object" || Array.isArray(call.arguments)))
    ) {
      throw new Error("O provedor retornou uma chamada de ferramenta inválida.");
    }
  }

  const callIds = response.toolCalls.map((call) => call.id);

  if (new Set(callIds).size !== callIds.length) {
    throw new Error("O provedor retornou chamadas de ferramenta duplicadas.");
  }

  return response;
}

export async function runAssistant({ provider, prompt, history = [], toolDeclarations, executeTool }) {
  // Valida o provedor
  if (
    !provider ||
    typeof provider.startConversation !== "function" ||
    typeof provider.continueConversation !== "function"
  ) {
    throw new Error("Provedor de IA inválido ou incompleto.");
  }

  // Valida a mensagem
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("A mensagem enviada ao assistente é inválida.");
  }

  // Valida o histórico
  validateHistory(history);

  // Valida as ferramentas
  if (!Array.isArray(toolDeclarations)) {
    throw new Error("As declarações de ferramentas são inválidas.");
  }

  if (typeof executeTool !== "function") {
    throw new Error("O executor de ferramentas é inválido.");
  }

  // Inicia a conversa com o provedor
  let response = validateProviderResponse(
    await provider.startConversation({
      prompt: prompt.trim(),
      history,
      tools: toolDeclarations,
    }),
  );

  // Limite de segurança para evitar ciclos infinitos
  const maxToolRounds = 5;

  for (let round = 0; round < maxToolRounds; round++) {
    // Se não houver ferramentas solicitadas, retorna a resposta
    if (response.toolCalls.length === 0) {
      return response.text;
    }

    // Valida o identificador da conversa
    if (typeof response.conversationId !== "string" || !response.conversationId.trim()) {
      throw new Error("O provedor não retornou um identificador de conversa válido.");
    }

    // Executa as ferramentas autorizadas
    const toolResults = await Promise.all(
      response.toolCalls.map(async (call) => {
        try {
          const result = await executeTool(call.name, call.arguments ?? {});

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

    // Continua a interação com os resultados das ferramentas
    response = validateProviderResponse(
      await provider.continueConversation({
        conversationId: response.conversationId,
        toolResults,
        tools: toolDeclarations,
      }),
    );
  }

  throw new Error("O limite de execuções de ferramentas foi atingido.");
}
