import { Request } from "express";

import { AppError } from "../errors/AppError";

export const getAuthenticatedUserId = (req: Request) => {
  if (!req.user?.id) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  }

  return req.user.id;
};
