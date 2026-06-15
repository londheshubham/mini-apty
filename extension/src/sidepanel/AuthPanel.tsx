import { FormEvent, useState } from "react";

import { useAuthStore } from "../stores/auth.store";

const getErrorLabel = (kind: string) => {
  if (kind === "network") {
    return "Network";
  }

  if (kind === "auth") {
    return "Auth";
  }

  if (kind === "validation") {
    return "Validation";
  }

  return "Error";
};

export const AuthPanel = () => {
  const { error, mode, setMode, status, submitCredentials, user, logout } =
    useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isLoading = status === "loading";
  const isSignup = mode === "signup";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await submitCredentials({
      email,
      password,
    });
  };

  if (status === "authenticated" && user) {
    return (
      <section className="panel-section auth-card">
        <div>
          <h2>Signed in</h2>
          <p className="muted">{user.email}</p>
        </div>
        <button type="button" className="secondary-button" onClick={logout}>
          Log out
        </button>
      </section>
    );
  }

  return (
    <section className="panel-section auth-card">
      <div className="auth-header">
        <div>
          <h2>{isSignup ? "Create account" : "Sign in"}</h2>
          <p className="muted">
            Use your Mini Apty backend account to save walkthroughs.
          </p>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() => setMode(isSignup ? "login" : "signup")}
        >
          {isSignup ? "Sign in" : "Sign up"}
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : 1}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
          />
        </label>

        {error ? (
          <div className={`error-box error-box-${error.kind}`}>
            <strong>{getErrorLabel(error.kind)}</strong>
            <span>{error.message}</span>
          </div>
        ) : null}

        <button type="submit" className="primary-button" disabled={isLoading}>
          {isLoading ? "Please wait..." : isSignup ? "Create and sign in" : "Sign in"}
        </button>
      </form>
    </section>
  );
};
