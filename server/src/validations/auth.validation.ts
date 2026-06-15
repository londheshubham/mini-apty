import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().trim().email("Email must be valid").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Email must be valid").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const formatValidationDetails = (error: z.ZodError) => {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
};

export { z };
