import { useEffect, useRef, useState } from "react";
import {
  Bot,
  User,
  Send,
  Plus,
  LoaderCircle,
  AlertCircle,
  MessageCircle,
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import api from "../services/api";

export default function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Mantém a conversa posicionada na mensagem mais recente
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  // Componentes utilizados na renderização do Markdown
  const markdownComponents = {
    p: ({ children }) => (
      <p className="mb-3 last:mb-0 leading-relaxed">
        {children}
      </p>
    ),

    strong: ({ children }) => (
      <strong className="font-bold text-gray-900 dark:text-white">
        {children}
      </strong>
    ),

    em: ({ children }) => (
      <em className="italic">{children}</em>
    ),

    ul: ({ children }) => (
      <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">
        {children}
      </ul>
    ),

    ol: ({ children }) => (
      <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">
        {children}
      </ol>
    ),

    li: ({ children }) => (
      <li className="pl-1">{children}</li>
    ),

    h1: ({ children }) => (
      <h1 className="mb-3 mt-4 text-xl font-bold first:mt-0">
        {children}
      </h1>
    ),

    h2: ({ children }) => (
      <h2 className="mb-2 mt-4 text-lg font-bold first:mt-0">
        {children}
      </h2>
    ),

    h3: ({ children }) => (
      <h3 className="mb-2 mt-3 text-base font-bold first:mt-0">
        {children}
      </h3>
    ),

    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-4 border-purple-400 pl-3 italic text-gray-600 dark:text-gray-300">
        {children}
      </blockquote>
    ),

    table: ({ children }) => (
      <div className="my-3 overflow-x-auto rounded-lg border border-gray-300 dark:border-gray-600">
        <table className="w-full border-collapse text-left text-sm">
          {children}
        </table>
      </div>
    ),

    th: ({ children }) => (
      <th className="border-b border-gray-300 bg-gray-200 px-3 py-2 font-semibold dark:border-gray-600 dark:bg-[#493365]">
        {children}
      </th>
    ),

    td: ({ children }) => (
      <td className="border-b border-gray-200 px-3 py-2 dark:border-gray-600">
        {children}
      </td>
    ),

    hr: () => (
      <hr className="my-4 border-gray-300 dark:border-gray-600" />
    ),

    code: ({ children }) => (
      <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-purple-800 dark:bg-[#241832] dark:text-purple-300">
        {children}
      </code>
    ),

    pre: ({ children }) => (
      <pre className="my-3 overflow-x-auto rounded-lg bg-gray-200 p-3 text-xs dark:bg-[#241832]">
        {children}
      </pre>
    ),
  };

  // Envia uma mensagem ao backend
  async function handleSendMessage(valueOrEvent) {
    let message;

    if (typeof valueOrEvent === "string") {
      message = valueOrEvent.trim();
    } else {
      valueOrEvent.preventDefault();
      message = input.trim();
    }

    if (!message || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setInput("");

    try {
      const response = await api.post("/assistant/message", {
        message,
        conversationId,
      });

      const {
        conversationId: returnedConversationId,
        response: assistantResponse,
      } = response.data;

      if (
        typeof returnedConversationId !== "string" ||
        typeof assistantResponse !== "string"
      ) {
        throw new Error("O servidor retornou uma resposta inválida.");
      }

      setConversationId(returnedConversationId);

      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "user",
          content: message,
        },
        {
          role: "assistant",
          content: assistantResponse,
        },
      ]);
    } catch (requestError) {
      const status = requestError.response?.status;

      if (status === 404) {
        setConversationId(null);
        setMessages([]);

        setError(
          "Esta conversa expirou. Inicie uma nova conversa para continuar.",
        );
      } else {
        setError(
          requestError.response?.data?.error?.message ||
          requestError.response?.data?.message ||
          requestError.message ||
          "Não foi possível enviar sua mensagem. Tente novamente.",
        );
      }

      setInput(message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  // Inicia uma nova conversa
  function handleNewConversation() {
    if (loading) {
      return;
    }

    setMessages([]);
    setConversationId(null);
    setInput("");
    setError("");

    inputRef.current?.focus();
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[var(--bg-main)] px-4 py-6 transition-colors">
      <div className="mx-auto flex h-[calc(100vh-112px)] max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">

        {/* Cabeçalho */}
        <header className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-[#8B5CF6]/20 dark:text-[#A78BFA]">
              <Bot size={25} />
            </div>

            <div>
              <h1 className="text-lg font-semibold text-[var(--text-main)]">
                Assistente IA
              </h1>

              <p className="text-sm text-[var(--text-muted)]">
                Assistente inteligente do sistema
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNewConversation}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition-colors hover:bg-gray-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#38264F]"
            title="Iniciar nova conversa"
          >
            <Plus size={17} />
            <span className="hidden sm:inline">Nova conversa</span>
          </button>
        </header>

        {/* Área das mensagens */}
        <section
          className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6
            [scrollbar-width:thin]
            [scrollbar-color:var(--color-primary)_var(--bg-main)]
            [&::-webkit-scrollbar]:w-2
            [&::-webkit-scrollbar-track]:bg-[var(--bg-main)]
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-[var(--color-primary)]
            [&::-webkit-scrollbar-thumb:hover]:bg-[var(--color-primary-hover)]"
          aria-label="Histórico da conversa"
          aria-live="polite"
        >
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 dark:bg-[#8B5CF6]/20 dark:text-[#A78BFA]">
                <MessageCircle size={34} />
              </div>

              <h2 className="mb-2 text-xl font-semibold text-[var(--text-main)]">
                Como posso ajudar?
              </h2>

              <p className="max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
                Faça perguntas sobre alunos, mensalidades e informações
                financeiras do sistema.
              </p>

              <div className="mt-6 grid w-full max-w-md gap-3 text-left sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    handleSendMessage("Quantos alunos estão cadastrados?")
                  }
                  disabled={loading}
                  className="rounded-lg border border-[var(--border-color)] p-3 text-sm text-[var(--text-main)] transition-colors hover:border-purple-400 hover:bg-purple-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#38264F]"
                >
                  Quantos alunos estão cadastrados?
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSendMessage("Quanto temos para receber neste mês?")
                  }
                  disabled={loading}
                  className="rounded-lg border border-[var(--border-color)] p-3 text-sm text-[var(--text-main)] transition-colors hover:border-purple-400 hover:bg-purple-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#38264F]"
                >
                  Quanto temos para receber neste mês?
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSendMessage("Quantas mensalidades estão atrasadas?")
                  }
                  disabled={loading}
                  className="rounded-lg border border-[var(--border-color)] p-3 text-sm text-[var(--text-main)] transition-colors hover:border-purple-400 hover:bg-purple-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#38264F]"
                >
                  Quantas mensalidades estão atrasadas?
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSendMessage(
                      "Quais alunos possuem pagamentos pendentes?",
                    )
                  }
                  disabled={loading}
                  className="rounded-lg border border-[var(--border-color)] p-3 text-sm text-[var(--text-main)] transition-colors hover:border-purple-400 hover:bg-purple-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#38264F]"
                >
                  Quais alunos possuem pagamentos pendentes?
                </button>
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            const isUser = message.role === "user";

            return (
              <div
                key={index}
                className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"
                  }`}
              >
                {!isUser && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-[#8B5CF6]/20 dark:text-[#A78BFA]">
                    <Bot size={20} />
                  </div>
                )}

                <div
                  className={`max-w-[85%] break-words rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${isUser
                      ? "whitespace-pre-wrap rounded-tr-sm bg-[var(--color-primary)] text-white"
                      : "rounded-tl-sm bg-gray-100 text-gray-800 dark:bg-[#38264F] dark:text-gray-100"
                    }`}
                >
                  {isUser ? (
                    message.content
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {message.content}
                    </ReactMarkdown>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-gray-700 dark:bg-[#38264F] dark:text-gray-200">
                    <User size={20} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Indicador de processamento */}
          {loading && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-[#8B5CF6]/20 dark:text-[#A78BFA]">
                <Bot size={20} />
              </div>

              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 text-sm text-gray-600 dark:bg-[#38264F] dark:text-gray-300">
                <LoaderCircle size={17} className="animate-spin" />
                Analisando sua pergunta...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </section>

        {/* Mensagem de erro */}
        {error && (
          <div
            role="alert"
            className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Campo de mensagem */}
        <form
          onSubmit={handleSendMessage}
          className="border-t border-[var(--border-color)] p-4"
        >
          <div className="mx-auto flex max-w-4xl items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage(event);
                }
              }}
              placeholder="Digite sua pergunta..."
              rows={1}
              disabled={loading}
              className="max-h-32 min-h-12 flex-1 resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 text-sm text-[var(--text-main)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--color-primary)] disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white transition-colors hover:bg-[var(--color-primary-hover)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Enviar mensagem"
              title="Enviar mensagem"
            >
              {loading ? (
                <LoaderCircle size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>

          <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
            O assistente pode cometer erros. Confira informações importantes.
          </p>
        </form>
      </div>
    </div>
  );
}