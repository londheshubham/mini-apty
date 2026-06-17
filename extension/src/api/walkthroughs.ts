import { z } from "zod";

import { CapturedStep, ElementPointer } from "../shared/messages";
import { apiRequest } from "./client";

const advanceTriggerSchema = z.enum([
  "next-button",
  "click-target",
  "input-change",
]);

const pointerStrategySchema = z.enum([
  "attribute-selector",
  "id-selector",
  "css-selector",
  "dom-path",
]);

const elementPointerSchema = z.object({
  strategy: pointerStrategySchema,
  selector: z.string().min(1),
  candidateSelectors: z.array(z.string().min(1)),
  fallbackPath: z.string().min(1),
  text: z.string().optional(),
  textFingerprint: z.string().optional(),
  role: z.string().optional(),
  tagName: z.string().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
}) satisfies z.ZodType<ElementPointer>;

const walkthroughStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  element: elementPointerSchema,
  advanceTrigger: advanceTriggerSchema,
}) satisfies z.ZodType<CapturedStep>;

const walkthroughSchema = z.object({
  id: z.string(),
  name: z.string(),
  origin: z.string().url(),
  pathPattern: z.string(),
  steps: z.array(walkthroughStepSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Walkthrough = z.infer<typeof walkthroughSchema>;

export type CreateWalkthroughInput = {
  name: string;
  origin: string;
  pathPattern: string;
  steps: CapturedStep[];
};

export const createWalkthrough = async (
  token: string,
  input: CreateWalkthroughInput,
) => {
  const response = await apiRequest<unknown>("/walkthroughs", {
    method: "POST",
    token,
    body: input,
  });

  return walkthroughSchema.parse(response);
};

export const updateWalkthrough = async (
  token: string,
  id: string,
  input: CreateWalkthroughInput,
) => {
  const response = await apiRequest<unknown>(`/walkthroughs/${id}`, {
    method: "PUT",
    token,
    body: input,
  });

  return walkthroughSchema.parse(response);
};
