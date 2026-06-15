import { normalizeApiError, normalizeUnknownError } from "./errors";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type RequestOptions = Omit<RequestInit, "body"> & {
  token?: string | null;
  body?: unknown;
};

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {},
) => {
  const { token, body, headers, ...requestInit } = options;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestInit,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      await normalizeApiError(response);
    }

    return (await response.json()) as T;
  } catch (error: unknown) {
    throw normalizeUnknownError(error);
  }
};
