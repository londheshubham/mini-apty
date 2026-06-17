import { Walkthrough } from "../api/walkthroughs";

const WALKTHROUGH_CACHE_STORAGE_KEY = "miniAptyWalkthroughCache";

type WalkthroughPage = Pick<Walkthrough, "origin" | "pathPattern">;
type WalkthroughCache = Record<string, Record<string, Walkthrough[]>>;

const getCacheKey = (walkthrough: WalkthroughPage) => {
  return `${walkthrough.origin}${walkthrough.pathPattern}`;
};

const readCache = async () => {
  const stored = await chrome.storage.local.get(WALKTHROUGH_CACHE_STORAGE_KEY);

  return (
    (stored[WALKTHROUGH_CACHE_STORAGE_KEY] as WalkthroughCache | undefined) ??
    {}
  );
};

export const getCachedWalkthroughs = async (
  userId: string,
  page: WalkthroughPage,
) => {
  const cache = await readCache();

  return cache[userId]?.[getCacheKey(page)] ?? [];
};

export const cacheWalkthroughs = async (
  userId: string,
  page: WalkthroughPage,
  walkthroughs: Walkthrough[],
) => {
  const cache = await readCache();
  const cacheKey = getCacheKey(page);

  await chrome.storage.local.set({
    [WALKTHROUGH_CACHE_STORAGE_KEY]: {
      ...cache,
      [userId]: {
        ...(cache[userId] ?? {}),
        [cacheKey]: walkthroughs,
      },
    },
  });
};

export const cacheWalkthrough = async (
  userId: string,
  walkthrough: Walkthrough,
) => {
  const cache = await readCache();
  const cacheKey = getCacheKey(walkthrough);
  const userCache = cache[userId] ?? {};
  const cachedWalkthroughs = userCache[cacheKey] ?? [];
  const nextWalkthroughs = [
    walkthrough,
    ...cachedWalkthroughs.filter((item) => item.id !== walkthrough.id),
  ];

  await chrome.storage.local.set({
    [WALKTHROUGH_CACHE_STORAGE_KEY]: {
      ...cache,
      [userId]: {
        ...userCache,
        [cacheKey]: nextWalkthroughs,
      },
    },
  });
};

export const removeCachedWalkthrough = async (
  userId: string,
  walkthrough: Walkthrough,
) => {
  const cache = await readCache();
  const cacheKey = getCacheKey(walkthrough);
  const userCache = cache[userId] ?? {};
  const cachedWalkthroughs = userCache[cacheKey] ?? [];

  await chrome.storage.local.set({
    [WALKTHROUGH_CACHE_STORAGE_KEY]: {
      ...cache,
      [userId]: {
        ...userCache,
        [cacheKey]: cachedWalkthroughs.filter(
          (item) => item.id !== walkthrough.id,
        ),
      },
    },
  });
};
