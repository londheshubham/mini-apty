import { Walkthrough } from "../api/walkthroughs";

const WALKTHROUGH_CACHE_STORAGE_KEY = "miniAptyWalkthroughCache";

type WalkthroughCache = Record<string, Walkthrough[]>;

const getCacheKey = (walkthrough: Pick<Walkthrough, "origin" | "pathPattern">) => {
  return `${walkthrough.origin}${walkthrough.pathPattern}`;
};

export const cacheWalkthrough = async (walkthrough: Walkthrough) => {
  const stored = await chrome.storage.local.get(WALKTHROUGH_CACHE_STORAGE_KEY);
  const cache =
    (stored[WALKTHROUGH_CACHE_STORAGE_KEY] as WalkthroughCache | undefined) ??
    {};
  const cacheKey = getCacheKey(walkthrough);
  const cachedWalkthroughs = cache[cacheKey] ?? [];
  const nextWalkthroughs = [
    walkthrough,
    ...cachedWalkthroughs.filter((item) => item.id !== walkthrough.id),
  ];

  await chrome.storage.local.set({
    [WALKTHROUGH_CACHE_STORAGE_KEY]: {
      ...cache,
      [cacheKey]: nextWalkthroughs,
    },
  });
};
