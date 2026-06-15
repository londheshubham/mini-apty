import { AuthUser } from "../api/auth";

const AUTH_STORAGE_KEY = "miniAptyAuth";

type StoredAuth = {
  token: string;
  user: AuthUser;
};

export const loadStoredAuth = async () => {
  const stored = await chrome.storage.local.get(AUTH_STORAGE_KEY);

  return (stored[AUTH_STORAGE_KEY] as StoredAuth | undefined) ?? null;
};

export const saveStoredAuth = async (auth: StoredAuth) => {
  await chrome.storage.local.set({
    [AUTH_STORAGE_KEY]: auth,
  });
};

export const clearStoredAuth = async () => {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
};
