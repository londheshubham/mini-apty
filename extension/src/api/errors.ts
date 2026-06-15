import { z } from "zod";

const backendErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorKind =
  | "network"
  | "auth"
  | "validation"
  | "forbidden"
  | "notFound"
  | "unknown";

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  details?: unknown;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number; code?: string; details?: unknown } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

const getKindFromStatus = (status: number): ApiErrorKind => {
  if (status === 400 || status === 422) {
    return "validation";
  }

  if (status === 401) {
    return "auth";
  }

  if (status === 403) {
    return "forbidden";
  }

  if (status === 404) {
    return "notFound";
  }

  return "unknown";
};

export const normalizeApiError = async (response: Response) => {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      getKindFromStatus(response.status),
      response.statusText || "Request failed",
      {
        status: response.status,
      },
    );
  }

  const parsedError = backendErrorSchema.safeParse(body);

  if (!parsedError.success) {
    throw new ApiError(
      getKindFromStatus(response.status),
      response.statusText || "Request failed",
      {
        status: response.status,
      },
    );
  }

  throw new ApiError(
    getKindFromStatus(response.status),
    parsedError.data.error.message,
    {
      status: response.status,
      code: parsedError.data.error.code,
      details: parsedError.data.error.details,
    },
  );
};

export const normalizeUnknownError = (error: unknown) => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof TypeError) {
    return new ApiError(
      "network",
      "Could not reach the Mini Apty backend. Is it running?",
    );
  }

  return new ApiError(
    "unknown",
    error instanceof Error ? error.message : "Something went wrong",
  );
};
