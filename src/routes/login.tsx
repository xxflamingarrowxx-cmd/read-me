import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { EmailAuth } from "@/components/readme/email-auth";
import { ReadMeLogo } from "@/components/readme/logo";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6">
        <ReadMeLogo className="brand-logo" />
        <p className="mt-2 text-muted">Sign in to open the shelves and award a review.</p>
        <div className="mt-5 grid gap-2">
          {GROK_PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              className="btn btn-primary"
              onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
            >
              Continue with {provider.label}
            </button>
          ))}
          <EmailAuth />
        </div>
      </div>
    </main>
  );
}
