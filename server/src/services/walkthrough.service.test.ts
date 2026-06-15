import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";

import { AppDataSource } from "../config/datasource";
import { AppError } from "../errors/AppError";
import {
  createWalkthroughService,
  getWalkthroughService,
  listWalkthroughsService,
  updateWalkthroughService,
} from "./walkthrough.service";

const createdAt = new Date("2026-06-15T10:00:00.000Z");
const updatedAt = new Date("2026-06-15T10:05:00.000Z");

const sampleInput = {
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
      advanceTrigger: "input-change" as const,
    },
  ],
};

const savedWalkthrough = {
  id: "walkthrough-1",
  ...sampleInput,
  owner: {
    id: "user-1",
  },
  createdAt,
  updatedAt,
};

const mockWalkthroughRepository = (repository: unknown) => {
  mock.method(AppDataSource, "getRepository", () => repository);
};

afterEach(() => {
  mock.restoreAll();
});

test("createWalkthroughService saves a walkthrough for the owner", async () => {
  const repository = {
    create: mock.fn((input) => ({
      id: "walkthrough-1",
      ...input,
      createdAt,
      updatedAt,
    })),
    save: mock.fn(async (walkthrough) => walkthrough),
  };
  mockWalkthroughRepository(repository);

  const walkthrough = await createWalkthroughService("user-1", sampleInput);

  assert.equal(repository.create.mock.callCount(), 1);
  assert.equal(repository.save.mock.callCount(), 1);
  assert.deepEqual(walkthrough, {
    id: "walkthrough-1",
    name: "Signup flow",
    origin: "https://example.com",
    pathPattern: "/signup",
    steps: sampleInput.steps,
    createdAt,
    updatedAt,
  });
});

test("listWalkthroughsService filters by owner, origin, path and sorts newest first", async () => {
  const repository = {
    find: mock.fn(async (_options: unknown) => [savedWalkthrough]),
  };
  mockWalkthroughRepository(repository);

  const walkthroughs = await listWalkthroughsService("user-1", {
    origin: "https://example.com",
    path: "/signup",
  });

  assert.deepEqual(repository.find.mock.calls[0].arguments[0], {
    where: {
      owner: {
        id: "user-1",
      },
      origin: "https://example.com",
      pathPattern: "/signup",
    },
    order: {
      createdAt: "DESC",
    },
  });
  assert.equal(walkthroughs.length, 1);
});

test("getWalkthroughService rejects access to another owner's walkthrough", async () => {
  mockWalkthroughRepository({
    findOne: mock.fn(async () => ({
      ...savedWalkthrough,
      owner: {
        id: "other-user",
      },
    })),
  });

  await assert.rejects(
    () => getWalkthroughService("user-1", "walkthrough-1"),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 403 &&
      error.code === "FORBIDDEN",
  );
});

test("updateWalkthroughService merges and saves an owned walkthrough", async () => {
  const repository = {
    findOne: mock.fn(async () => ({ ...savedWalkthrough })),
    merge: mock.fn((walkthrough, input) => Object.assign(walkthrough, input)),
    save: mock.fn(async (walkthrough) => walkthrough),
  };
  mockWalkthroughRepository(repository);

  const updated = await updateWalkthroughService("user-1", "walkthrough-1", {
    name: "Updated flow",
  });

  assert.equal(repository.merge.mock.callCount(), 1);
  assert.equal(repository.save.mock.callCount(), 1);
  assert.equal(updated.name, "Updated flow");
});
