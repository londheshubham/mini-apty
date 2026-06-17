import {
  ExtensionMessage,
  RuntimeMessage,
  WalkthroughPlayback,
} from "../shared/messages";
import { isCaptureActive, startCapture, stopCapture } from "./capture";
import { ensureOverlayRoot } from "./overlay";
import { startPlayback, stopPlayback } from "./playback";

const PLAYBACK_SESSION_STORAGE_KEY = "miniAptyActivePlayback";
const PLAYBACK_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

type PlaybackSession = {
  href: string;
  origin: string;
  pathname: string;
  walkthrough: WalkthroughPlayback;
  stepIndex: number;
  updatedAt: number;
};

const getPageContext = () => ({
  href: window.location.href,
  origin: window.location.origin,
  pathname: window.location.pathname,
});

const sendRuntimeMessage = (message: RuntimeMessage) => {
  try {
    void Promise.resolve(chrome.runtime.sendMessage(message)).catch(
      () => undefined,
    );
  } catch {
    // Old content scripts can outlive an extension reload during local dev.
  }
};

const persistPlaybackSession = async (
  walkthrough: WalkthroughPlayback,
  stepIndex: number,
) => {
  const pageContext = getPageContext();

  try {
    await chrome.storage.local.set({
      [PLAYBACK_SESSION_STORAGE_KEY]: {
        ...pageContext,
        walkthrough,
        stepIndex,
        updatedAt: Date.now(),
      } satisfies PlaybackSession,
    });
  } catch {
    // Playback should keep working even if extension storage is unavailable.
  }
};

const clearPlaybackSession = async () => {
  try {
    await chrome.storage.local.remove(PLAYBACK_SESSION_STORAGE_KEY);
  } catch {
    // Nothing to clean up if the extension context is already gone.
  }
};

const readPlaybackSession = async () => {
  try {
    const stored = await chrome.storage.local.get(PLAYBACK_SESSION_STORAGE_KEY);

    return stored[PLAYBACK_SESSION_STORAGE_KEY] as PlaybackSession | undefined;
  } catch {
    return undefined;
  }
};

const isPlaybackSessionForCurrentPage = (session: PlaybackSession) => {
  const pageContext = getPageContext();

  return (
    session.href === pageContext.href &&
    session.origin === pageContext.origin &&
    session.pathname === pageContext.pathname
  );
};

const getPlaybackOptions = () => ({
  isCaptureActive,
  stopCapture,
  onStepChange: (walkthrough: WalkthroughPlayback, stepIndex: number) => {
    void persistPlaybackSession(walkthrough, stepIndex);
  },
  onStop: () => {
    void clearPlaybackSession();
  },
});

const restorePlaybackSession = async () => {
  const session = await readPlaybackSession();

  if (!session) {
    return;
  }

  if (Date.now() - session.updatedAt > PLAYBACK_SESSION_TTL_MS) {
    void clearPlaybackSession();
    return;
  }

  if (!isPlaybackSessionForCurrentPage(session)) {
    return;
  }

  startPlayback(session.walkthrough, getPlaybackOptions(), session.stepIndex);
};

ensureOverlayRoot();
void restorePlaybackSession();

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (message.type === "MINI_APTY_GET_PAGE_CONTEXT") {
      sendResponse({
        ok: true,
        pageContext: getPageContext(),
      });
      return false;
    }

    if (message.type === "MINI_APTY_START_CAPTURE") {
      startCapture({
        sendRuntimeMessage,
        stopPlayback,
      });
      sendResponse({
        ok: true,
        message: "capture-started",
      });
      return false;
    }

    if (message.type === "MINI_APTY_STOP_CAPTURE") {
      stopCapture();
      sendResponse({
        ok: true,
        message: "capture-stopped",
      });
      return false;
    }

    if (message.type === "MINI_APTY_PLAY_WALKTHROUGH") {
      const didStart = startPlayback(message.walkthrough, getPlaybackOptions());

      sendResponse(
        didStart
          ? {
              ok: true,
              message: "playback-started",
            }
          : {
              ok: false,
              error: "Walkthrough has no steps",
            },
      );
      return false;
    }

    if (message.type === "MINI_APTY_PING") {
      sendResponse({
        ok: true,
        message: "pong",
      });
      return false;
    }

    sendResponse({
      ok: false,
      error: "Unknown message",
    });
    return false;
  },
);
