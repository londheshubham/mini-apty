import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";

import jwt from "jsonwebtoken";

import { AppDataSource } from "../config/datasource";
import { AppError } from "../errors/AppError";
import { loginService, signupService } from "./auth.service";

const mockUserRepository = (repository: unknown) => {
  mock.method(AppDataSource, "getRepository", () => repository);
};

afterEach(() => {
  mock.restoreAll();
  delete process.env.JWT_SECRET;
});

test("signupService creates a user when the email is available", async () => {
  const repository = {
    findOne: mock.fn(async () => null),
    create: mock.fn((input) => ({
      id: "user-1",
      ...input,
    })),
    save: mock.fn(async (user) => ({
      ...user,
      id: "user-1",
      email: "author@example.com",
    })),
  };
  mockUserRepository(repository);

  const user = await signupService("author@example.com", "password123");

  assert.deepEqual(user, {
    id: "user-1",
    email: "author@example.com",
  });
  assert.equal(repository.findOne.mock.callCount(), 1);
  assert.equal(repository.create.mock.callCount(), 1);
  assert.equal(repository.save.mock.callCount(), 1);
});

test("signupService rejects duplicate emails", async () => {
  mockUserRepository({
    findOne: mock.fn(async () => ({
      id: "existing-user",
      email: "author@example.com",
    })),
  });

  await assert.rejects(
    () => signupService("author@example.com", "password123"),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 409 &&
      error.code === "EMAIL_EXISTS",
  );
});

test("loginService returns a signed token for valid credentials", async () => {
  process.env.JWT_SECRET = "test-secret";
  const password = "password123";
  const bcrypt = await import("bcrypt");
  const passwordHash = await bcrypt.default.hash(password, 4);

  mockUserRepository({
    findOne: mock.fn(async () => ({
      id: "user-1",
      email: "author@example.com",
      passwordHash,
    })),
  });

  const result = await loginService("author@example.com", password);
  const payload = jwt.verify(result.token, "test-secret") as jwt.JwtPayload;

  assert.equal(payload.userId, "user-1");
  assert.deepEqual(result.user, {
    id: "user-1",
    email: "author@example.com",
  });
});

test("loginService rejects missing users as invalid credentials", async () => {
  mockUserRepository({
    findOne: mock.fn(async () => null),
  });

  await assert.rejects(
    () => loginService("missing@example.com", "password123"),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 401 &&
      error.code === "INVALID_CREDENTIALS",
  );
});
