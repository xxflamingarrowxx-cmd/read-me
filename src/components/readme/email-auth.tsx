import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { setDisplayName } from "@/lib/readme/api";

export function EmailAuth() {
  const [mode, setMode] = useState<"up" | "in">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-4 grid gap-2 border-t border-line pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        const chosen = name.trim();
        if (mode === "up" && chosen.length < 2) {
          setError("Add the name you want on your shelf.");
          setBusy(false);
          return;
        }
        const request =
          mode === "up"
            ? authClient.signUp.email({
                email: email.trim(),
                password,
                name: chosen,
                callbackURL: "/",
              })
            : authClient.signIn.email({
                email: email.trim(),
                password,
                callbackURL: "/",
              });
        void request
          .then(async (result) => {
            if (result.error) {
              setError(result.error.message ?? "That didn’t work.");
              setBusy(false);
              return;
            }
            if (mode === "up") await setDisplayName({ data: chosen }).catch(() => undefined);
            window.location.assign("/");
          })
          .catch(() => {
            setError("That didn’t work.");
            setBusy(false);
          });
      }}
    >
      <p className="text-sm text-muted">{mode === "up" ? "Or open a shelf with email." : "Welcome back."}</p>
      {mode === "up" && (
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name on the shelf"
          aria-label="Name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={24}
          className="field"
        />
      )}
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        type="email"
        required
        placeholder="Email"
        aria-label="Email"
        autoComplete="email"
        className="field"
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        type="password"
        required
        minLength={8}
        placeholder="Password, 8 characters"
        aria-label="Password"
        autoComplete={mode === "up" ? "new-password" : "current-password"}
        className="field"
      />
      {error && <p className="text-sm text-accent">{error}</p>}
      <button type="submit" className="btn btn-surface" disabled={busy}>
        {busy ? "One moment…" : mode === "up" ? "Create my shelf" : "Sign in"}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          setMode(mode === "up" ? "in" : "up");
          setError(null);
        }}
      >
        {mode === "up" ? "I already have a shelf" : "I’m new here"}
      </button>
    </form>
  );
}
