import { create } from "zustand";

import { AuthUser, login, signup } from "../api/auth";
import { ApiError, normalizeUnknownError } from "../api/errors";
import {
  clearStoredAuth,
  loadStoredAuth,
  saveStoredAuth,
} from "../storage/auth.storage";

type AuthMode = "login" | "signup";
type AuthStatus = "idle" | "loading" | "authenticated" | "error";

type Credentials = {
  email: string;
  password: string;
};

type AuthState = {
  mode: AuthMode;
  status: AuthStatus;
  token: string | null;
  user: AuthUser | null;
  error: ApiError | null;
  setMode: (mode: AuthMode) => void;
  loadSession: () => Promise<void>;
  submitCredentials: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  mode: "login",
  status: "idle",
  token: null,
  user: null,
  error: null,
  setMode: (mode) => {
    set({
      mode,
      error: null,
    });
  },
  loadSession: async () => {
    const storedAuth = await loadStoredAuth();

    if (!storedAuth) {
      set({
        status: "idle",
        token: null,
        user: null,
      });
      return;
    }

    set({
      status: "authenticated",
      token: storedAuth.token,
      user: storedAuth.user,
      error: null,
    });
  },
  submitCredentials: async (credentials) => {
    set({
      status: "loading",
      error: null,
    });

    try {
      if (get().mode === "signup") {
        await signup(credentials);
      }

      const session = await login(credentials);

      await saveStoredAuth(session);

      set({
        status: "authenticated",
        token: session.token,
        user: session.user,
        error: null,
      });
    } catch (error: unknown) {
      set({
        status: "error",
        error: normalizeUnknownError(error),
      });
    }
  },
  logout: async () => {
    await clearStoredAuth();

    set({
      status: "idle",
      token: null,
      user: null,
      error: null,
    });
  },
}));
