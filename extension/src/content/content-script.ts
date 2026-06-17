import { ExtensionMessage, RuntimeMessage } from "../shared/messages";
import { isCaptureActive, startCapture, stopCapture } from "./capture";
import { ensureOverlayRoot } from "./overlay";
import { startPlayback, stopPlayback } from "./playback";

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

ensureOverlayRoot();

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
      const didStart = startPlayback(message.walkthrough, {
        isCaptureActive,
        stopCapture,
      });

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
