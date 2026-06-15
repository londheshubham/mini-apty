import { ExtensionMessage } from "../shared/messages";

const ROOT_ID = "mini-apty-overlay-root";

const getPageContext = () => ({
  href: window.location.href,
  origin: window.location.origin,
  pathname: window.location.pathname,
});

const ensureOverlayRoot = () => {
  const existing = document.getElementById(ROOT_ID);

  if (existing?.shadowRoot) {
    return existing.shadowRoot;
  }

  const host = document.createElement("mini-apty-overlay");
  host.id = ROOT_ID;
  host.style.all = "initial";
  document.documentElement.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
    }

    .mini-apty-badge {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #c7d2fe;
      background: #eef2ff;
      color: #312e81;
      font: 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
      pointer-events: none;
    }
  `;

  const badge = document.createElement("div");
  badge.className = "mini-apty-badge";
  badge.textContent = "Mini Apty ready";

  shadowRoot.append(style, badge);

  return shadowRoot;
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
