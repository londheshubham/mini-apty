const ROOT_ID = "mini-apty-overlay-root";

export const isOverlayElement = (element: Element | null) => {
  return Boolean(element?.closest?.(`#${ROOT_ID}`));
};

export const isElementVisible = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none"
  );
};

export const getOverlayElements = () => {
  const shadowRoot = ensureOverlayRoot();

  return {
    badge: shadowRoot.querySelector<HTMLElement>(".mini-apty-badge"),
    highlight: shadowRoot.querySelector<HTMLElement>(".mini-apty-highlight"),
    popover: shadowRoot.querySelector<HTMLElement>(".mini-apty-popover"),
    shield: shadowRoot.querySelector<HTMLElement>(".mini-apty-capture-shield"),
  };
};

export const ensureOverlayRoot = () => {
  const existing = document.getElementById(ROOT_ID);

  if (existing?.shadowRoot) {
    if (existing.shadowRoot.querySelector(".mini-apty-popover")) {
      return existing.shadowRoot;
    }

    existing.remove();
  } else {
    existing?.remove();
  }

  const host = document.createElement("mini-apty-overlay");
  host.id = ROOT_ID;
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";
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

    .mini-apty-badge.recording {
      border-color: #818cf8;
      background: #4f46e5;
      color: #ffffff;
    }

    .mini-apty-highlight {
      display: none;
      position: fixed;
      z-index: 2147483647;
      border: 2px solid #4f46e5;
      border-radius: 6px;
      background: rgba(79, 70, 229, 0.1);
      box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.18);
      pointer-events: none;
    }

    .mini-apty-popover {
      display: none;
      position: fixed;
      z-index: 2147483647;
      width: min(320px, calc(100vw - 24px));
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.22);
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      pointer-events: auto;
    }

    .mini-apty-popover-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 12px;
    }

    .mini-apty-popover-step {
      flex: 0 0 auto;
      color: #64748b;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }

    .mini-apty-popover-title {
      margin: 0;
      color: #0f172a;
      font-size: 14px;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .mini-apty-popover-body {
      display: grid;
      gap: 10px;
      padding: 10px 12px 12px;
    }

    .mini-apty-popover-description {
      margin: 0;
      color: #334155;
      overflow-wrap: anywhere;
    }

    .mini-apty-popover-warning {
      margin: 0;
      color: #92400e;
      font-size: 12px;
    }

    .mini-apty-popover-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }

    .mini-apty-popover button {
      border-radius: 6px;
      padding: 7px 9px;
      font: 700 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
    }

    .mini-apty-popover-next {
      border: 1px solid #4f46e5;
      background: #4f46e5;
      color: #ffffff;
    }

    .mini-apty-popover-prev {
      border: 1px solid #4f46e5;
      background: #4f46e5;
      color: #ffffff;
    }

    .mini-apty-popover-stop {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
    }

    .mini-apty-popover button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .mini-apty-capture-shield {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 2147483645;
      background: transparent;
      cursor: crosshair;
      pointer-events: auto;
    }
  `;

  const badge = document.createElement("div");
  badge.className = "mini-apty-badge";
  badge.textContent = "Mini Apty ready";

  const highlight = document.createElement("div");
  highlight.className = "mini-apty-highlight";

  const popover = document.createElement("div");
  popover.className = "mini-apty-popover";

  const shield = document.createElement("div");
  shield.className = "mini-apty-capture-shield";

  shadowRoot.append(style, shield, highlight, popover, badge);

  return shadowRoot;
};

export const setBadgeText = (text: string) => {
  const { badge } = getOverlayElements();

  if (badge) {
    badge.textContent = text;
  }
};

export const setBadgeRecording = (recording: boolean) => {
  const { badge } = getOverlayElements();

  badge?.classList.toggle("recording", recording);
};

export const setCaptureShieldVisible = (visible: boolean) => {
  const { shield } = getOverlayElements();

  if (shield) {
    shield.style.display = visible ? "block" : "none";
  }
};

export const updateHighlight = (element: HTMLElement | null) => {
  const { highlight } = getOverlayElements();

  if (!highlight) {
    return;
  }

  if (!element) {
    highlight.style.display = "none";
    return;
  }

  const rect = element.getBoundingClientRect();

  highlight.style.display = "block";
  highlight.style.left = `${rect.left}px`;
  highlight.style.top = `${rect.top}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;
};
