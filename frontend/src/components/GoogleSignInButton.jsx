import { useEffect, useRef, useState } from "react";

const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

let googleScriptPromise = null;

function loadGoogleScript() {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    let script = document.getElementById(GOOGLE_SCRIPT_ID);

    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", resolve, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Não foi possível carregar o Google Identity Services.")),
      { once: true },
    );

    if (window.google?.accounts?.id) {
      resolve();
    }
  }).catch((error) => {
    googleScriptPromise = null;
    throw error;
  });

  return googleScriptPromise;
}

export default function GoogleSignInButton({
  onCredential,
  onError,
  disabled = false,
}) {
  const buttonRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    let mounted = true;

    async function initializeGoogle() {
      try {
        if (!clientId) {
          throw new Error(
            "A configuração do Google ainda não foi definida.",
          );
        }

        await loadGoogleScript();

        if (!mounted || !buttonRef.current) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!mounted) return;

            if (!response?.credential) {
              onError?.("O Google não retornou uma credencial válida.");
              return;
            }

            onCredential(response.credential);
          },
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 320,
        });

        setLoading(false);
      } catch (error) {
        if (!mounted) return;

        setLoading(false);
        onError?.(error.message || "Não foi possível carregar o login com Google.");
      }
    }

    initializeGoogle();

    return () => {
      mounted = false;

      if (buttonRef.current) {
        buttonRef.current.innerHTML = "";
      }
    };
  }, [clientId, onCredential, onError]);

  return (
    <div className="w-full">
      <div
        ref={buttonRef}
        className={`flex justify-center transition-opacity ${disabled ? "pointer-events-none opacity-50" : ""
          }`}
        aria-busy={loading}
      />

      {loading && (
        <p className="mt-2 text-center text-xs text-gray-400">
          Carregando opção de login com Google...
        </p>
      )}
    </div>
  );
}
