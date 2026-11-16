import { requestAssistantResponse } from "../ai/index.js";

import { createConversation, getConversation, addConversationMessage } from "../ai/conversationStore.js";

const MAX_MESSAGE_LENGTH = 4000;

function createSafeError(message, status) {
  const error = new Error(message);
  error.status = status;
  error.isSafe = true;
  return error;
}

function validateUserId(userId) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw createSafeError("Usuário inválido.", 401);
  }
}

// Cria o serviço com a função de resposta que será utilizada.
export function createAssistantService(responseGenerator = requestAssistantResponse) {
  return {
    async sendMessage(message, conversationId, userId) {
      validateUserId(userId);

      if (typeof message !== "string" || !message.trim()) {
        throw createSafeError("A mensagem não pode estar vazia.", 400);
      }

      const normalizedMessage = message.trim();

      if (normalizedMessage.length > MAX_MESSAGE_LENGTH) {
        throw createSafeError(`A mensagem ultrapassou o limite de ${MAX_MESSAGE_LENGTH} caracteres.`, 400);
      }

      if (conversationId !== undefined && conversationId !== null && typeof conversationId !== "string") {
        throw createSafeError("O identificador da conversa é inválido.", 400);
      }

      let conversation;

      if (conversationId && conversationId.trim()) {
        conversation = getConversation(conversationId.trim(), userId);

        if (!conversation) {
          throw createSafeError("Conversa não encontrada ou expirada. Inicie uma nova conversa.", 404);
        }
      } else {
        conversation = createConversation(userId);
      }

      let response;

      try {
        response = await responseGenerator({
          prompt: normalizedMessage,
          history: conversation.messages,
          userId,
        });
      } catch (error) {
        const rawStatus = error?.status ?? error?.statusCode ?? error?.response?.status;
        const statusCode = Number(rawStatus);

        // Preserva erros 4xx explicitamente marcados como seguros
        if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500 && error.isSafe === true) {
          throw error;
        }

        const errorMessage = String(error?.message || "").toLowerCase();
        const errorName = String(error?.name || "").toLowerCase();

        console.error("Erro ao processar mensagem do assistente com o provedor de IA:", {
          name: error?.name || "Erro desconhecido",
          message: error?.message || "Sem mensagem de erro",
          status: Number.isInteger(statusCode) ? statusCode : null,
        });

        let status = 502;
        let errorMessageResponse = "Não foi possível estabelecer comunicação com o serviço de IA.";

        if (
          statusCode === 408 ||
          statusCode === 504 ||
          errorName.includes("timeout") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("timed out") ||
          errorName.includes("continuationinterrupted")
        ) {
          status = 504;
          errorMessageResponse = "O serviço de IA demorou demais para responder. Tente novamente.";
        } else if (statusCode === 503 || statusCode === 429) {
          status = 503;
          errorMessageResponse = "O serviço de IA está temporariamente indisponível. Tente novamente em instantes.";
        }

        const serviceError = new Error(errorMessageResponse, {
          cause: error,
        });

        serviceError.status = status;
        serviceError.isSafe = true;

        throw serviceError;
      }

      // Armazenamento das mensagens no histórico da conversa
      try {
        addConversationMessage(conversation.conversationId, "user", normalizedMessage, userId);
        addConversationMessage(conversation.conversationId, "assistant", response, userId);
      } catch (storeError) {
        console.error("Erro ao registrar mensagens no armazenamento da conversa:", {
          conversationId: conversation.conversationId,
          userId,
          error: storeError?.message || storeError,
        });

        const storageError = new Error("Erro interno ao atualizar o histórico da conversa.", {
          cause: storeError,
        });
        storageError.status = 500;
        throw storageError;
      }

      return {
        conversationId: conversation.conversationId,
        response,
      };
    },
  };
}

// Serviço utilizado normalmente pela aplicação.
export const assistantService = createAssistantService();
