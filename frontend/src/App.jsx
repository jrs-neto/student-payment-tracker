import React, { useState, useEffect, useCallback } from "react";
import {
  Sun,
  Moon,
  Bot,
  LogOut,
  LoaderCircle,
  AlertCircle,
  Settings,
} from "lucide-react";

import AlunosPage from "./pages/AlunosPage";
import MensalidadesPage from "./pages/MensalidadesPage";
import AssistantPage from "./pages/AssistantPage";

import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import AccountSettingsPage from "./components/AccountSettingsPage";

import { authService } from "./services/authService";
import { resetDemoData } from "./services/demoDataApi";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [verifying, setVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const [authView, setAuthView] = useState("login");
  const [activeTab, setActiveTab] = useState("alunos");

  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme) return savedTheme;

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  // Aplica e persiste o tema.
  useEffect(() => {
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  // Verifica a sessão ao carregar a aplicação.
  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      const token = localStorage.getItem("token");

      if (!token) {
        if (isMounted) {
          setIsAuthenticated(false);
          setVerifying(false);
          setVerificationError(false);
          setCurrentUser(null);
        }

        return;
      }

      try {
        const session = await authService.getMe();

        if (isMounted) {
          setIsAuthenticated(true);
          setIsDemo(session.user?.isDemo === true);
          setCurrentUser(session.user ?? null);
          setVerificationError(false);
        }
      } catch (err) {
        const status = err.response?.status;

        if (!isMounted) return;

        if (status === 401) {
          authService.logout();
          setIsAuthenticated(false);
          setIsDemo(false);
          setCurrentUser(null);
          setAuthView("login");
          setActiveTab("alunos");
          setVerificationError(false);
        } else {
          // Falhas de conexão ou erros do servidor não invalidam
          // automaticamente uma sessão que ainda pode ser válida.
          setVerificationError(true);
        }
      } finally {
        if (isMounted) {
          setVerifying(false);
        }
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [retryCount]);

  // Recebe avisos do Axios quando uma sessão expira.
  useEffect(() => {
    function handleUnauthorized() {
      authService.logout();
      resetDemoData();
      setIsAuthenticated(false);
      setIsDemo(false);
      setCurrentUser(null);
      setAuthView("login");
      setActiveTab("alunos");
    }

    window.addEventListener("auth:unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prevTheme) =>
      prevTheme === "dark" ? "light" : "dark"
    );
  };

  const handleLoginSuccess = async () => {
    const session = await authService.getMe();
    if (session.user?.isDemo !== true) resetDemoData();
    setVerificationError(false);
    setAuthView("login");
    setIsDemo(session.user?.isDemo === true);
    setCurrentUser(session.user ?? null);
    setActiveTab("alunos");
    setIsAuthenticated(true);
  };

  const handleRegisterSuccess = async () => {
    setVerifying(true);
    setVerificationError(false);

    try {
      const session = await authService.getMe();

      if (session.user?.isDemo !== true) {
        resetDemoData();
      }

      setAuthView("login");
      setActiveTab("alunos");
      setIsDemo(session.user?.isDemo === true);
      setCurrentUser(session.user ?? null);
      setIsAuthenticated(true);
    } catch (err) {
      const status = err.response?.status;

      if (status === 401) {
        authService.logout();
        setIsAuthenticated(false);
        setIsDemo(false);
        setCurrentUser(null);
        setAuthView("login");
        setActiveTab("alunos");
        setVerificationError(false);
      } else {
        // A conta foi criada, mas não conseguimos confirmar a sessão.
        // Mantemos o token para permitir uma nova tentativa.
        setIsAuthenticated(false);
        setIsDemo(false);
        setCurrentUser(null);
        setVerificationError(true);
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    resetDemoData();
    setIsAuthenticated(false);
    setIsDemo(false);
    setCurrentUser(null);
    setAuthView("login");
    setActiveTab("alunos");
  };

  const handleGoogleLinked = useCallback((linkedUser) => {
    setCurrentUser((user) => ({
      ...(user ?? {}),
      ...linkedUser,
      googleLinked: Boolean(linkedUser?.google_id),
    }));
  }, []);

  const getTabClass = (tab) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${activeTab === tab
      ? "bg-purple-100 dark:bg-[#8B5CF6]/20 text-purple-700 dark:text-[#A78BFA]"
      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
    }`;

  // Carregamento inicial.
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)]">
        <div className="flex flex-col items-center gap-3">
          <LoaderCircle
            size={36}
            className="animate-spin text-[#8B5CF6]"
          />

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Verificando sessão...
          </p>
        </div>
      </div>
    );
  }

  // Falha temporária na comunicação com o backend.
  if (verificationError && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)] px-4">
        <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-lg p-8 text-center">
          <AlertCircle
            size={36}
            className="mx-auto mb-4 text-amber-500"
          />

          <h1 className="text-xl font-bold mb-2">
            Não foi possível verificar sua sessão
          </h1>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Não conseguimos estabelecer comunicação com o servidor.
            Sua sessão não foi encerrada. Tente novamente.
          </p>

          <button
            onClick={() => {
              setVerifying(true);
              setVerificationError(false);
              setRetryCount((count) => count + 1);
            }}
            className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-3 rounded-lg text-sm font-semibold transition cursor-pointer"
          >
            Tentar novamente
          </button>

          <button
            onClick={handleLogout}
            className="mt-3 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  // Tela de autenticação.
  if (!isAuthenticated) {
    if (authView === "register") {
      return (
        <RegisterPage
          onRegisterSuccess={handleRegisterSuccess}
          onSwitchToLogin={() => setAuthView("login")}
        />
      );
    }

    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setAuthView("register")}
      />
    );
  }

  // Painel principal.
  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)]">
      <nav className="bg-white dark:bg-[#1B1428] border-b border-gray-200 dark:border-[#38264F] transition-colors">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("alunos")}
              className={getTabClass("alunos")}
            >
              Alunos
            </button>

            <button
              onClick={() => setActiveTab("mensalidades")}
              className={getTabClass("mensalidades")}
            >
              Mensalidades
            </button>

            <button
              onClick={() => setActiveTab("assistente")}
              className={getTabClass("assistente")}
            >
              <Bot size={17} />
              Assistente IA
            </button>

            {!isDemo && (
              <button
                onClick={() => setActiveTab("conta")}
                className={getTabClass("conta")}
              >
                <Settings size={17} />
                Conta
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Mudar para o modo claro"
                  : "Mudar para o modo escuro"
              }
              className="p-2 rounded-lg cursor-pointer bg-gray-100 dark:bg-[#38264F] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#4c356b] transition-colors"
              title={
                theme === "dark"
                  ? "Alternar para Modo Claro"
                  : "Alternar para Modo Escuro"
              }
            >
              {theme === "dark" ? (
                <Sun size={20} />
              ) : (
                <Moon size={20} />
              )}
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900 transition cursor-pointer"
              title="Encerrar sessão"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </nav>

      {isDemo && (
        <div role="status" className="bg-purple-100 dark:bg-[#38264F] px-4 py-2 text-center text-sm font-medium text-purple-900 dark:text-purple-100">
          Modo demonstração — alterações temporárias, não são salvas.
        </div>
      )}

      <main>
        {activeTab === "alunos" && <AlunosPage demoMode={isDemo} />}
        {activeTab === "mensalidades" && <MensalidadesPage demoMode={isDemo} />}
        {activeTab === "assistente" && <AssistantPage />}
        {activeTab === "conta" && !isDemo && (
          <AccountSettingsPage
            user={currentUser}
            isDemo={isDemo}
            onGoogleLinked={handleGoogleLinked}
          />
        )}
      </main>
    </div>
  );
}
