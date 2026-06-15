import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { AuthUser } from "../types/auth";

type JwtPayload = {
  userId: string;
};

const unauthorized = (res: Response, message = "Authentication required") => {
  return res.status(401).json({
    error: {
      code: "UNAUTHORIZED",
      message,
    },
  });
};

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.header("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return unauthorized(res);
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as JwtPayload;

    if (!payload.userId) {
      return unauthorized(res, "Invalid token");
    }

    req.user = {
      id: payload.userId,
    };

    return next();
  } catch {
    return unauthorized(res, "Invalid token");
  }
};
