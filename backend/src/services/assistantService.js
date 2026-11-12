import { requestAssistantResponse } from "../ai/index.js";

import { createConversation, getConversation, addConversationMessage } from "../ai/conversationStore.js";

const MAX_MESSAGE_LENGTH = 4000;

// Cria o serviço com a função de resposta que será utilizada
export function createAssistantService(responseGenerator = requestAssistantResponse) {
  return {
    async sendMessage(message, conversationId) {
      let conversation;

      if (typeof message !== "string" || !message.trim()) {
        const error = new Error("A mensagem não pode estar vazia.");
        error.status = 400;
        error.isSafe = true;
        throw error;
      }

      const normalizedMessage = message.trim();

      if (normalizedMessage.length > MAX_MESSAGE_LENGTH) {
        const error = new Error(`A mensagem ultrapassou o limite de ${MAX_MESSAGE_LENGTH} caracteres.`);
        error.status = 400;
        error.isSafe = true;
        throw error;
      }

      if (conversationId !== undefined && conversationId !== null && typeof conversationId !== "string") {
        const error = new Error("O identificador da conversa é inválido.");
        error.status = 400;
        error.isSafe = true;
        throw error;
      }

      if (conversationId && conversationId.trim()) {
        conversation = getConversation(conversationId.trim());

        if (!conversation) {
          const error = new Error("Conversa não encontrada ou expirada. Inicie uma nova conversa.");
          error.status = 404;
          error.isSafe = true;
          throw error;
        }
      } else {
        conversation = createConversation();
      }

      try {
        const response = await responseGenerator({
          prompt: normalizedMessage,
          history: conversation.messages,
        });

        addConversationMessage(conversation.conversationId, "user", normalizedMessage);

        addConversationMessage(conversation.conversationId, "assistant", response);

        return {
          conversationId: conversation.conversationId,
          response,
        };
      } catch (error) {
        const errorMessage = String(error?.message || "").toLowerCase();
        const errorName = String(error?.name || "").toLowerCase();

        const rawStatus = error?.status ?? error?.statusCode ?? error?.response?.status;

        const statusCode = Number(rawStatus);

        console.error("Erro ao processar mensagem do assistente:", {
          name: error?.name || "Erro desconhecido",
          message: error?.message || "Sem mensagem de erro",
          status: Number.isInteger(statusCode) ? statusCode : null,
        });

        let status = 502;
        let errorMessageResponse = "Não foi possível estabelecer comunicação com o serviço de IA.";

        if (errorName.includes("timeout") || errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
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

        throw serviceError;
      }
    },
  };
}

// Serviço utilizado normalmente pela aplicação
export const assistantService = createAssistantService();
