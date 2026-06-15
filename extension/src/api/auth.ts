import { z } from "zod";

import { apiRequest } from "./client";

const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});

const loginResponseSchema = z.object({
  token: z.string().min(1),
  user: authUserSchema,
});

const signupResponseSchema = authUserSchema;

export type AuthUser = z.infer<typeof authUserSchema>;

export type LoginInput = {
  email: string;
  password: string;
};

export const signup = async (input: LoginInput) => {
  const response = await apiRequest<unknown>("/auth/signup", {
    method: "POST",
    body: input,
  });

  return signupResponseSchema.parse(response);
};

export const login = async (input: LoginInput) => {
  const response = await apiRequest<unknown>("/auth/login", {
    method: "POST",
    body: input,
  });

  return loginResponseSchema.parse(response);
};
