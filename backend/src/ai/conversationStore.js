import { randomUUID } from "node:crypto";

const conversations = new Map();

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const MAX_MESSAGES = 20;

// Remove conversas que ultrapassaram o tempo de inatividade
function removeExpiredConversations() {
  const now = Date.now();

  for (const [id, conversation] of conversations) {
    if (now - conversation.updatedAt >= INACTIVITY_LIMIT_MS) {
      conversations.delete(id);
    }
  }
}

// Cria uma nova conversa
export function createConversation() {
  removeExpiredConversations();

  const conversationId = randomUUID();

  const conversation = {
    id: conversationId,
    messages: [],
    updatedAt: Date.now(),
  };

  conversations.set(conversationId, conversation);

  return {
    conversationId,
    messages: [],
  };
}

// Recupera uma conversa existente
export function getConversation(conversationId) {
  if (typeof conversationId !== "string" || !conversationId.trim()) {
    return null;
  }

  removeExpiredConversations();

  const conversation = conversations.get(conversationId);

  if (!conversation) {
    return null;
  }

  conversation.updatedAt = Date.now();

  return {
    conversationId: conversation.id,
    messages: conversation.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  };
}

// Adiciona uma mensagem ao histórico
export function addConversationMessage(conversationId, role, content) {
  if (!["user", "assistant"].includes(role)) {
    throw new Error("Papel da mensagem inválido.");
  }

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("O conteúdo da mensagem é inválido.");
  }

  const conversation = conversations.get(conversationId);

  if (!conversation) {
    throw new Error("Conversa não encontrada ou expirada.");
  }

  conversation.messages.push({
    role,
    content: content.trim(),
  });

  if (conversation.messages.length > MAX_MESSAGES) {
    conversation.messages.splice(0, conversation.messages.length - MAX_MESSAGES);
  }

  conversation.updatedAt = Date.now();

  return getConversation(conversationId);
}
