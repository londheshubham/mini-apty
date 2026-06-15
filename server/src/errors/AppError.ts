export class AppError extends Error {
  statusCode: number;
  code: string;
  expose: boolean;
  details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options: { expose?: boolean; details?: unknown } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.expose = options.expose ?? statusCode < 500;
    this.details = options.details;
  }
}

export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};
