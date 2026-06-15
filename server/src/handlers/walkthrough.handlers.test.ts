import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";

import { Request, Response } from "express";

import { AppDataSource } from "../config/datasource";
import {
  createWalkthrough,
  getWalkthrough,
  listWalkthroughs,
} from "./walkthrough.handlers";

const createdAt = new Date("2026-06-15T10:00:00.000Z");
const updatedAt = new Date("2026-06-15T10:05:00.000Z");

const validBody = {
  name: "Signup flow",
  origin: "https://example.com",
  pathPattern: "/signup",
  steps: [
    {
      id: "step-1",
      title: "Email",
      description: "Enter your email",
      element: {
        strategy: "css-with-fallbacks",
        selector: "input[name='email']",
      },
      advanceTrigger: "input-change",
    },
  ],
};

const makeResponse = () => {
  const response = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    sent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send() {
      this.sent = true;
      return this;
    },
  };

  return response as unknown as Response & typeof response;
};

const mockWalkthroughRepository = (repository: unknown) => {
  mock.method(AppDataSource, "getRepository", () => repository);
};

afterEach(() => {
  mock.restoreAll();
});

test("createWalkthrough returns 201 for a valid authenticated request", async () => {
  mockWalkthroughRepository({
    create: mock.fn((input) => ({
      id: "walkthrough-1",
      ...input,
      createdAt,
      updatedAt,
    })),
    save: mock.fn(async (walkthrough) => walkthrough),
  });
  const req = {
    body: validBody,
    user: {
      id: "user-1",
    },
  } as Request;
  const res = makeResponse();

  await createWalkthrough(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, {
    id: "walkthrough-1",
    ...validBody,
    createdAt,
    updatedAt,
  });
});

test("createWalkthrough returns 400 for invalid request body", async () => {
  const req = {
    body: {
      ...validBody,
      steps: [],
    },
    user: {
      id: "user-1",
    },
  } as Request;
  const res = makeResponse();

  await createWalkthrough(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual((res.body as { error: { code: string } }).error.code, "VALIDATION_ERROR");
});

test("listWalkthroughs returns owner-scoped walkthroughs", async () => {
  mockWalkthroughRepository({
    find: mock.fn(async () => [
      {
        id: "walkthrough-1",
        ...validBody,
        createdAt,
        updatedAt,
      },
    ]),
  });
  const req = {
    query: {
      origin: "https://example.com",
      path: "/signup",
    },
    user: {
      id: "user-1",
    },
  } as unknown as Request;
  const res = makeResponse();

  await listWalkthroughs(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal((res.body as unknown[]).length, 1);
});

test("getWalkthrough returns 403 when the walkthrough belongs to another user", async () => {
  mockWalkthroughRepository({
    findOne: mock.fn(async () => ({
      id: "550e8400-e29b-41d4-a716-446655440000",
      ...validBody,
      owner: {
        id: "other-user",
      },
      createdAt,
      updatedAt,
    })),
  });
  const req = {
    params: {
      id: "550e8400-e29b-41d4-a716-446655440000",
    },
    user: {
      id: "user-1",
    },
  } as unknown as Request;
  const res = makeResponse();

  await getWalkthrough(req, res);

  assert.equal(res.statusCode, 403);
  assert.deepEqual((res.body as { error: { code: string } }).error.code, "FORBIDDEN");
});
