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
  strategy: pointerStrategySchema.catch("css-selector"),
  selector: z.string().min(1),
  candidateSelectors: z.array(z.string().min(1)).optional(),
  fallbackPath: z.string().min(1).optional(),
  text: z.string().optional(),
  textFingerprint: z.string().optional(),
  role: z.string().optional(),
  tagName: z.string().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
}).transform((pointer) => ({
  ...pointer,
  candidateSelectors: pointer.candidateSelectors ?? [pointer.selector],
  fallbackPath: pointer.fallbackPath ?? pointer.selector,
})) satisfies z.ZodType<ElementPointer>;

const walkthroughStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  element: elementPointerSchema,
  advanceTrigger: advanceTriggerSchema.optional().default("next-button"),
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

export type ListWalkthroughsInput = {
  origin: string;
  path: string;
};

export const listWalkthroughs = async (
  token: string,
  input: ListWalkthroughsInput,
) => {
  const query = new URLSearchParams({
    origin: input.origin,
    path: input.path,
  });
  const response = await apiRequest<unknown>(`/walkthroughs?${query.toString()}`, {
    method: "GET",
    token,
  });

  return z.array(walkthroughSchema).parse(response);
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

export const deleteWalkthrough = async (token: string, id: string) => {
  await apiRequest<void>(`/walkthroughs/${id}`, {
    method: "DELETE",
    token,
  });
};
