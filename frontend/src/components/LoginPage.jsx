import React, { useCallback, useState } from "react";
import {
  LoaderCircle,
  AlertCircle,
  Eye,
  EyeOff,
  CreditCard,
  FlaskConical,
} from "lucide-react";

import { authService } from "../services/authService";
import GoogleSignInButton from "./GoogleSignInButton";

export default function LoginPage({
  onLoginSuccess,
  onSwitchToRegister,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError("Preencha todos os campos.");
      return;
    }

    try {
      setLoading(true);

      const result = await authService.login(normalizedEmail, password);

      await onLoginSuccess(result.user);
    } catch (err) {
      if (!err.response) {
        setError(
          "Não foi possível conectar ao servidor. Verifique sua conexão.",
        );
      } else if (err.response.status >= 500) {
        setError(
          "Ocorreu uma instabilidade no servidor. Tente novamente em instantes.",
        );
      } else if (err.response.status === 401) {
        const message =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          "E-mail ou senha incorretos.";

        setError(message);
      } else {
        const message =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          "Não foi possível realizar o login. Verifique os dados informados.";

        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError(null);

    try {
      setDemoLoading(true);

      await authService.demoLogin();

      await onLoginSuccess();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
        "Não foi possível acessar a demonstração.",
      );
    } finally {
      setDemoLoading(false);
    }
  }

  const handleGoogleCredential = useCallback(
    async (idToken) => {
      setError(null);

      try {
        setGoogleLoading(true);

        const result = await authService.googleLogin(idToken);

        await onLoginSuccess(result.user);
      } catch (err) {
        if (!err.response) {
          setError(
            "Não foi possível conectar ao servidor. Verifique sua conexão.",
          );
        } else if (err.response.status >= 500) {
          setError(
            "Ocorreu uma instabilidade no servidor. Tente novamente em instantes.",
          );
        } else {
          const message =
            err.response?.data?.error?.message ||
            err.response?.data?.message ||
            "Não foi possível entrar com sua conta Google.";

          setError(message);
        }
      } finally {
        setGoogleLoading(false);
      }
    },
    [onLoginSuccess],
  );

  const handleGoogleError = useCallback((message) => {
    setError(message);
  }, []);

  const isLoading = loading || demoLoading || googleLoading;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)] transition-colors p-0 md:p-6 lg:p-8">
      <div className="w-full max-w-6xl min-h-screen md:min-h-[640px] lg:min-h-[700px] grid grid-cols-1 lg:grid-cols-2 bg-[var(--bg-surface)] md:border md:border-[var(--border-color)] md:rounded-2xl md:shadow-2xl overflow-hidden">

        {/* Lado Esquerdo — Área de Autenticação */}
        <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-[#161022] text-gray-100 relative">

          {/* Topo / Logo ou Marca sutil */}
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-[#8B5CF6]/20 flex items-center justify-center text-[#A78BFA] border border-[#8B5CF6]/30">
              <CreditCard size={20} />
            </div>

            <span className="font-semibold tracking-wide text-sm text-gray-200">
              Student Payment Tracker
            </span>
          </div>

          {/* Caixa de Login Centralizada */}
          <div className="max-w-md w-full mx-auto my-auto py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                Login
              </h1>

              <p className="text-sm text-gray-400">
                Entre para gerenciar suas mensalidades e alunos.
              </p>
            </div>

            {/* Mensagem de erro */}
            {error && (
              <div
                className="mb-6 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/50 p-3.5 text-sm text-red-300"
                role="alert"
              >
                <AlertCircle
                  size={18}
                  className="shrink-0 text-red-400"
                />

                <span>{error}</span>
              </div>
            )}

            {/* Formulário */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              aria-busy={isLoading}
            >
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-medium text-gray-300 mb-1.5"
                >
                  E-mail
                </label>

                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                  className="w-full bg-[#1F1733] text-white placeholder-gray-500 border border-[#38264F] rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent transition disabled:opacity-60"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-gray-300"
                  >
                    Senha
                  </label>
                </div>

                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                    className="w-full bg-[#1F1733] text-white placeholder-gray-500 border border-[#38264F] rounded-xl pl-4 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent transition disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition focus:outline-none cursor-pointer disabled:opacity-50"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-3.5 rounded-xl text-sm font-semibold transition shadow-lg shadow-purple-900/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>

            {/* Separador */}
            <div className="flex items-center gap-4 my-5">
              <div className="flex-1 h-px bg-[#38264F]" />

              <span className="text-xs text-gray-500">
                ou continue com
              </span>

              <div className="flex-1 h-px bg-[#38264F]" />
            </div>

            {/* Login com Google */}
            <div
              className={googleLoading ? "pointer-events-none opacity-60" : ""}
              aria-busy={googleLoading}
            >
              {googleLoading ? (
                <div className="w-full flex items-center justify-center gap-2 py-3">
                  <LoaderCircle
                    size={18}
                    className="animate-spin text-[#A78BFA]"
                  />

                  <span className="text-sm text-gray-300">
                    Entrando com Google...
                  </span>
                </div>
              ) : (
                <GoogleSignInButton
                  onCredential={handleGoogleCredential}
                  onError={handleGoogleError}
                  disabled={loading || demoLoading}
                />
              )}
            </div>

            {/* Acesso à demonstração */}
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl border border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-[#C4B5FD] py-3 text-sm font-semibold transition hover:bg-[#8B5CF6]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {demoLoading ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <FlaskConical size={17} />
              )}

              {demoLoading
                ? "Acessando demonstração..."
                : "Acessar conta de demonstração"}
            </button>
          </div>

          {/* Rodapé do Login / Cadastro */}
          <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm pt-4 border-t border-[#261C3A]">
            <span className="text-gray-400">
              Não tem uma conta?
            </span>

            <button
              type="button"
              onClick={onSwitchToRegister}
              disabled={isLoading}
              className="text-[#A78BFA] font-semibold hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Criar conta
            </button>
          </div>
        </div>

        {/* Lado Direito — Área Institucional */}
        <div className="relative hidden lg:flex flex-col justify-center p-12 lg:p-16 bg-gradient-to-br from-[#8B5CF6] via-[#7C3AED] to-[#6D28D9] text-white overflow-hidden">

          {/* Elementos decorativos de fundo */}
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />

          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-black/10 blur-3xl pointer-events-none" />

          {/* Conteúdo institucional */}
          <div className="relative z-10 max-w-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
                <CreditCard size={22} />
              </div>

              <span className="font-semibold text-sm text-purple-100 tracking-wide">
                Student Payment Tracker
              </span>
            </div>

            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white mb-4 leading-tight">
              Controle de pagamentos simples e eficiente
            </h2>

            <p className="text-purple-100 text-sm leading-relaxed">
              Organize mensalidades, acompanhe o status dos seus alunos e
              mantenha sua gestão financeira em dia.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
