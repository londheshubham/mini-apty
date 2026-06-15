import { Request, Response } from "express";

import { isAppError } from "../errors/AppError";
import { signupService, loginService } from "../services/auth.service";
import {
  formatValidationDetails,
  loginSchema,
  signupSchema,
  z,
} from "../validations/auth.validation";

const handleAuthError = (res: Response, error: unknown) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
        details: formatValidationDetails(error),
      },
    });
  }

  if (isAppError(error)) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.expose ? error.message : "Internal server error",
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    },
  });
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password } = signupSchema.parse(req.body);
    const user = await signupService(email, password);

    return res.status(201).json({
      id: user.id,
      email: user.email,
    });
  } catch (error: unknown) {
    return handleAuthError(res, error);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await loginService(email, password);

    return res.status(200).json(result);
  } catch (error: unknown) {
    return handleAuthError(res, error);
  }
};
