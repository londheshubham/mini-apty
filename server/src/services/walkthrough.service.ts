import { AppDataSource } from "../config/datasource";
import { Walkthrough } from "../entities/Walkthrough";
import { User } from "../entities/User";
import { AppError } from "../errors/AppError";
import {
  CreateWalkthroughInput,
  ListWalkthroughsQuery,
  UpdateWalkthroughInput,
} from "../validations/walkthrough.validation";

const walkthroughRepository = AppDataSource.getRepository(Walkthrough);

const serializeWalkthrough = (walkthrough: Walkthrough) => ({
  id: walkthrough.id,
  name: walkthrough.name,
  origin: walkthrough.origin,
  pathPattern: walkthrough.pathPattern,
  steps: walkthrough.steps,
  createdAt: walkthrough.createdAt,
  updatedAt: walkthrough.updatedAt,
});

const findOwnedWalkthrough = async (id: string, ownerId: string) => {
  const walkthrough = await walkthroughRepository.findOne({
    where: {
      id,
    },
    relations: {
      owner: true,
    },
  });

  if (!walkthrough) {
    throw new AppError(404, "WALKTHROUGH_NOT_FOUND", "Walkthrough not found");
  }

  if (walkthrough.owner.id !== ownerId) {
    throw new AppError(403, "FORBIDDEN", "You cannot access this walkthrough");
  }

  return walkthrough;
};

export const createWalkthroughService = async (
  ownerId: string,
  input: CreateWalkthroughInput,
) => {
  const walkthrough = walkthroughRepository.create({
    ...input,
    owner: {
      id: ownerId,
    } as User,
  });

  const savedWalkthrough = await walkthroughRepository.save(walkthrough);

  return serializeWalkthrough(savedWalkthrough);
};

export const listWalkthroughsService = async (
  ownerId: string,
  query: ListWalkthroughsQuery,
) => {
  const walkthroughs = await walkthroughRepository.find({
    where: {
      owner: {
        id: ownerId,
      },
      ...(query.origin ? { origin: query.origin } : {}),
      ...(query.path ? { pathPattern: query.path } : {}),
    },
    order: {
      createdAt: "DESC",
    },
  });

  return walkthroughs.map(serializeWalkthrough);
};

export const getWalkthroughService = async (ownerId: string, id: string) => {
  const walkthrough = await findOwnedWalkthrough(id, ownerId);

  return serializeWalkthrough(walkthrough);
};

export const updateWalkthroughService = async (
  ownerId: string,
  id: string,
  input: UpdateWalkthroughInput,
) => {
  const walkthrough = await findOwnedWalkthrough(id, ownerId);

  walkthroughRepository.merge(walkthrough, input);

  const savedWalkthrough = await walkthroughRepository.save(walkthrough);

  return serializeWalkthrough(savedWalkthrough);
};

export const deleteWalkthroughService = async (ownerId: string, id: string) => {
  const walkthrough = await findOwnedWalkthrough(id, ownerId);

  await walkthroughRepository.remove(walkthrough);
};
