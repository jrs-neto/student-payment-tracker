import React, { useCallback, useState } from "react";
import { UserPlus, LoaderCircle, AlertCircle } from "lucide-react";

import { authService } from "../services/authService";
import GoogleSignInButton from "./GoogleSignInButton";

export default function RegisterPage({
  onRegisterSuccess,
  onSwitchToLogin,
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    const passwordBytes = new TextEncoder().encode(password).length;

    if (!normalizedName || !normalizedEmail || !password || !confirmPassword) {
      setError("Preencha todos os campos.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (passwordBytes > 72) {
      setError("A senha não pode ultrapassar 72 bytes.");
      return;
    }

    try {
      setLoading(true);

      const result = await authService.register(
        normalizedName,
        normalizedEmail,
        password,
      );

      await onRegisterSuccess(result.user);
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        "Não foi possível criar sua conta. O e-mail pode já estar em uso.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleCredential = useCallback(
    async (idToken) => {
      setError(null);

      try {
        setGoogleLoading(true);

        const result = await authService.googleLogin(idToken);

        await onRegisterSuccess(result.user);
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
            "Não foi possível criar sua conta com Google.";

          setError(message);
        }
      } finally {
        setGoogleLoading(false);
      }
    },
    [onRegisterSuccess],
  );

  const handleGoogleError = useCallback((message) => {
    setError(message);
  }, []);

  const isLoading = loading || googleLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)] px-4 py-8 transition-colors">
      <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-lg p-8">

        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-[#8B5CF6]/20 dark:text-[#A78BFA] mb-3">
            <UserPlus size={24} />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Criar Nova Conta
          </h1>

          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Comece a gerenciar suas mensalidades.
          </p>
        </div>

        {error && (
          <div
            className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            role="alert"
          >
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          aria-busy={isLoading}
        >
          <div>
            <label
              htmlFor="register-name"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Nome completo
            </label>

            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
              maxLength={100}
              required
              disabled={isLoading}
              className="w-full bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              E-mail
            </label>

            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              maxLength={150}
              required
              disabled={isLoading}
              className="w-full bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Senha
            </label>

            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={isLoading}
              className="w-full bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="register-confirm-password"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Confirmar senha
            </label>

            <input
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite a senha novamente"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={isLoading}
              className="w-full bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-3 rounded-lg text-sm font-semibold transition shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Criando conta...
              </>
            ) : (
              "Criar Conta"
            )}
          </button>
        </form>

        {/* Separador */}
        <div className="flex items-center gap-4 my-5">
          <div className="flex-1 h-px bg-[var(--border-color)]" />

          <span className="text-xs text-gray-500 dark:text-gray-400">
            ou continue com
          </span>

          <div className="flex-1 h-px bg-[var(--border-color)]" />
        </div>

        {/* Cadastro com Google */}
        {googleLoading ? (
          <div className="w-full flex items-center justify-center gap-2 py-3">
            <LoaderCircle
              size={18}
              className="animate-spin text-[#8B5CF6]"
            />

            <span className="text-sm text-gray-600 dark:text-gray-300">
              Criando conta com Google...
            </span>
          </div>
        ) : (
          <GoogleSignInButton
            onCredential={handleGoogleCredential}
            onError={handleGoogleError}
            disabled={loading}
          />
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Já tem uma conta?
          </span>

          <button
            type="button"
            onClick={onSwitchToLogin}
            disabled={isLoading}
            className="text-[#8B5CF6] font-semibold hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
