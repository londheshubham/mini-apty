import { z } from "zod";

const advanceTriggerSchema = z.enum([
  "next-button",
  "click-target",
  "input-change",
]);

const elementPointerSchema = z.object({
  strategy: z.string().min(1),
  selector: z.string().min(1),
  text: z.string().optional(),
  role: z.string().optional(),
  tagName: z.string().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
});

const walkthroughStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  element: elementPointerSchema,
  advanceTrigger: advanceTriggerSchema.optional(),
});

export const createWalkthroughSchema = z.object({
  name: z.string().trim().min(1),
  origin: z.string().trim().url(),
  pathPattern: z.string().trim().min(1),
  steps: z.array(walkthroughStepSchema).min(1),
});

export const updateWalkthroughSchema = createWalkthroughSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export const listWalkthroughsQuerySchema = z.object({
  origin: z.string().trim().url().optional(),
  path: z.string().trim().min(1).optional(),
});

export const walkthroughIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CreateWalkthroughInput = z.infer<typeof createWalkthroughSchema>;
export type UpdateWalkthroughInput = z.infer<typeof updateWalkthroughSchema>;
export type ListWalkthroughsQuery = z.infer<typeof listWalkthroughsQuerySchema>;
