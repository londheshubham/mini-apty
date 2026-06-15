import { Request, Response } from "express";
import { ZodError } from "zod";

import { isAppError } from "../errors/AppError";
import { getAuthenticatedUserId } from "../helpers/auth.helper";
import {
  createWalkthroughService,
  deleteWalkthroughService,
  getWalkthroughService,
  listWalkthroughsService,
  updateWalkthroughService,
} from "../services/walkthrough.service";
import {
  createWalkthroughSchema,
  listWalkthroughsQuerySchema,
  updateWalkthroughSchema,
  walkthroughIdParamsSchema,
} from "../validations/walkthrough.validation";
import { formatValidationDetails } from "../validations/auth.validation";

const handleWalkthroughError = (res: Response, error: unknown) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
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

  console.error("Unhandled walkthrough error", error);

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    },
  });
};

export const createWalkthrough = async (req: Request, res: Response) => {
  try {
    const input = createWalkthroughSchema.parse(req.body);
    const walkthrough = await createWalkthroughService(
      getAuthenticatedUserId(req),
      input,
    );

    return res.status(201).json(walkthrough);
  } catch (error: unknown) {
    return handleWalkthroughError(res, error);
  }
};

export const listWalkthroughs = async (req: Request, res: Response) => {
  try {
    const query = listWalkthroughsQuerySchema.parse(req.query);
    const walkthroughs = await listWalkthroughsService(
      getAuthenticatedUserId(req),
      query,
    );

    return res.status(200).json(walkthroughs);
  } catch (error: unknown) {
    return handleWalkthroughError(res, error);
  }
};

export const getWalkthrough = async (req: Request, res: Response) => {
  try {
    const { id } = walkthroughIdParamsSchema.parse(req.params);
    const walkthrough = await getWalkthroughService(
      getAuthenticatedUserId(req),
      id,
    );

    return res.status(200).json(walkthrough);
  } catch (error: unknown) {
    return handleWalkthroughError(res, error);
  }
};

export const updateWalkthrough = async (req: Request, res: Response) => {
  try {
    const { id } = walkthroughIdParamsSchema.parse(req.params);
    const input = updateWalkthroughSchema.parse(req.body);
    const walkthrough = await updateWalkthroughService(
      getAuthenticatedUserId(req),
      id,
      input,
    );

    return res.status(200).json(walkthrough);
  } catch (error: unknown) {
    return handleWalkthroughError(res, error);
  }
};

export const deleteWalkthrough = async (req: Request, res: Response) => {
  try {
    const { id } = walkthroughIdParamsSchema.parse(req.params);

    await deleteWalkthroughService(getAuthenticatedUserId(req), id);

    return res.status(204).send();
  } catch (error: unknown) {
    return handleWalkthroughError(res, error);
  }
};
