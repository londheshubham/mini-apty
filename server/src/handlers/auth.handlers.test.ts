import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";

import { Request, Response } from "express";

import { AppDataSource } from "../config/datasource";
import { login, signup } from "./auth.handlers";

const makeResponse = () => {
  const response = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response as unknown as Response & typeof response;
};

const mockUserRepository = (repository: unknown) => {
  mock.method(AppDataSource, "getRepository", () => repository);
};

afterEach(() => {
  mock.restoreAll();
  delete process.env.JWT_SECRET;
});

test("signup returns 201 for a valid request", async () => {
  mockUserRepository({
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
  });
  const req = {
    body: {
      email: "AUTHOR@example.com",
      password: "password123",
    },
  } as Request;
  const res = makeResponse();

  await signup(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, {
    id: "user-1",
    email: "author@example.com",
  });
});

test("signup returns 400 for invalid input", async () => {
  const req = {
    body: {
      email: "not-an-email",
      password: "short",
    },
  } as Request;
  const res = makeResponse();

  await signup(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal((res.body as { error: { code: string } }).error.code, "VALIDATION_ERROR");
});

test("signup returns 409 for duplicate email", async () => {
  mockUserRepository({
    findOne: mock.fn(async () => ({
      id: "existing-user",
      email: "author@example.com",
    })),
  });
  const req = {
    body: {
      email: "author@example.com",
      password: "password123",
    },
  } as Request;
  const res = makeResponse();

  await signup(req, res);

  assert.equal(res.statusCode, 409);
  assert.equal((res.body as { error: { code: string } }).error.code, "EMAIL_EXISTS");
});

test("login returns 200 with a token for valid credentials", async () => {
  process.env.JWT_SECRET = "test-secret";
  const bcrypt = await import("bcrypt");
  const passwordHash = await bcrypt.default.hash("password123", 4);
  mockUserRepository({
    findOne: mock.fn(async () => ({
      id: "user-1",
      email: "author@example.com",
      passwordHash,
    })),
  });
  const req = {
    body: {
      email: "author@example.com",
      password: "password123",
    },
  } as Request;
  const res = makeResponse();

  await login(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(typeof (res.body as { token: string }).token, "string");
});
