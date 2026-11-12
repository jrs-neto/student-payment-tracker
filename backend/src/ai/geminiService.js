import { startConversation, continueConversation } from "./providers/geminiProvider.js";

import { runAssistant } from "./assistantEngine.js";

import { toolDeclarations, executeTool } from "./tools/toolRegistry.js";

// Interface do provedor Gemini para o motor do assistente
const provider = {
  startConversation,
  continueConversation,
};

// Envia perguntas ao assistente e coordena a execução das ferramentas
export async function requestAssistantResponse({ prompt, history = [] }) {
  return runAssistant({
    provider,
    prompt,
    history,
    toolDeclarations,
    executeTool,
  });
}
