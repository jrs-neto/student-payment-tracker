import { useCallback, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Link2,
  LoaderCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import GoogleSignInButton from "./GoogleSignInButton";
import { authService } from "../services/authService";

function getLinkErrorMessage(error) {
  if (!error.response) {
    return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
  }

  const status = error.response.status;
  const message = error.response?.data?.error?.message || error.response?.data?.message;

  if (status >= 500) {
    return "Ocorreu uma instabilidade no servidor. Tente novamente em instantes.";
  }

  if (status === 401 && !message) {
    return "Sua sessão pode ter expirado. Entre novamente para continuar.";
  }

  if (status === 403) {
    return message || "Esta conta não pode vincular uma conta Google.";
  }

  if (status === 409) {
    return message || "Não foi possível vincular esta conta Google. Confira o e-mail e o vínculo atual.";
  }

  if (status === 429) {
    return message || "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  }

  return message || "Não foi possível vincular a conta Google. Verifique os dados e tente novamente.";
}

export default function AccountSettingsPage({ user, isDemo, onGoogleLinked }) {
  const [password, setPassword] = useState("");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const passwordRef = useRef("");
  const linkingRef = useRef(false);

  const hasGoogleStatus = typeof user?.googleLinked === "boolean";
  const googleLinked = user?.googleLinked === true;
  const demoAccount = isDemo || user?.isDemo === true || user?.is_demo === true;

  const clearPassword = useCallback(() => {
    passwordRef.current = "";
    setPassword("");
  }, []);

  const handleGoogleCredential = useCallback(async (idToken) => {
    if (linkingRef.current) return;

    setError("");
    setSuccess("");

    const currentPassword = passwordRef.current;

    if (!currentPassword) {
      setError("Informe sua senha atual antes de continuar com Google.");
      return;
    }

    linkingRef.current = true;

    try {
      setLinking(true);

      const result = await authService.linkGoogle(currentPassword, idToken);

      clearPassword();
      onGoogleLinked?.(result.user);
      setSuccess(result.message || "Conta Google vinculada com sucesso.");
    } catch (requestError) {
      clearPassword();
      setError(getLinkErrorMessage(requestError));
    } finally {
      linkingRef.current = false;
      setLinking(false);
    }
  }, [clearPassword, onGoogleLinked]);

  const handleGoogleError = useCallback((message) => {
    passwordRef.current = "";
    setPassword("");
    setError(message || "Não foi possível iniciar a autenticação Google.");
    setSuccess("");
  }, []);

  function handlePasswordChange(event) {
    passwordRef.current = event.target.value;
    setPassword(event.target.value);
    setError("");
    setSuccess("");
  }

  return (
    <section className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-purple-700 dark:text-[#A78BFA]">Configurações</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">Sua conta</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Consulte seus dados e gerencie o acesso à sua conta.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <UserRound size={19} className="text-purple-600 dark:text-[#A78BFA]" />
            <h2 className="font-semibold">Informações da conta</h2>
          </div>

          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Nome</dt>
              <dd className="mt-1 font-medium text-gray-900 dark:text-gray-100">{user?.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">E-mail</dt>
              <dd className="mt-1 break-all font-medium text-gray-900 dark:text-gray-100">{user?.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Tipo de conta</dt>
              <dd className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                {demoAccount ? "Demonstração" : "Conta pessoal"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Link2 size={19} className="text-purple-600 dark:text-[#A78BFA]" />
            <h2 className="font-semibold">Acesso com Google</h2>
          </div>

          {googleLinked ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 size={19} />
                <span>Conta Google vinculada</span>
              </div>
              <p className="mt-2 text-sm">
                Você pode entrar com sua senha ou com esta conta Google. A identidade vinculada não pode ser substituída aqui.
              </p>
            </div>
          ) : demoAccount ? (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-200">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck size={18} />
                <span>Vinculação indisponível</span>
              </div>
              <p className="mt-2">Contas de demonstração não podem vincular uma identidade Google.</p>
            </div>
          ) : (
            <>
              {hasGoogleStatus ? (
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Esta conta ainda não está vinculada ao Google.
                </p>
              ) : (
                <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  Não foi possível confirmar o vínculo nesta sessão. Você pode confirmar ou vincular usando a senha da conta e a identidade Google correta.
                </p>
              )}

              <label htmlFor="account-link-password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Senha atual
              </label>
              <div className="relative mb-4">
                <KeyRound size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="account-link-password"
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  autoComplete="current-password"
                  disabled={linking}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 dark:border-[#4B3A63] dark:bg-[#21182F] dark:text-gray-100"
                />
              </div>

              <div className={linking || !password ? "pointer-events-none opacity-50" : ""} aria-busy={linking}>
                <GoogleSignInButton
                  onCredential={handleGoogleCredential}
                  onError={handleGoogleError}
                  disabled={linking || !password}
                />
              </div>

              {linking && (
                <p role="status" className="mt-3 flex items-center justify-center gap-2 text-sm text-purple-700 dark:text-[#C4B5FD]">
                  <LoaderCircle size={17} className="animate-spin" />
                  Vinculando sua conta Google...
                </p>
              )}

              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                A senha confirma sua conta atual. O e-mail da conta Google precisa corresponder ao e-mail cadastrado.
              </p>
            </>
          )}

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
