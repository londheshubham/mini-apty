import {
  CapturedStep,
  ElementPointer,
  ExtensionMessage,
  RuntimeMessage,
} from "../shared/messages";

const ROOT_ID = "mini-apty-overlay-root";
const STABLE_ATTRIBUTES = [
  "data-testid",
  "data-test",
  "data-cy",
  "aria-label",
  "name",
  "id",
  "type",
  "href",
  "placeholder",
];
const CAPTURABLE_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[role='link']",
  "[role='textbox']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='combobox']",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
  "[aria-label]",
  "[name]",
  "[data-testid]",
  "[data-test]",
  "[data-cy]",
].join(",");
const BLOCKED_CAPTURE_EVENTS = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "click",
  "auxclick",
  "dblclick",
  "contextmenu",
  "touchstart",
  "touchend",
];

let isCapturing = false;
let highlightedElement: HTMLElement | null = null;
let lastPointerPosition: { x: number; y: number } | null = null;
let highlightFrame = 0;

const getPageContext = () => ({
  href: window.location.href,
  origin: window.location.origin,
  pathname: window.location.pathname,
});

const trimText = (value: string | null | undefined, maxLength = 120) => {
  return value?.replace(/\s+/g, " ").trim().slice(0, maxLength);
};

const escapeSelectorValue = (value: string) => {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};

const getOverlayElements = () => {
  const shadowRoot = ensureOverlayRoot();

  return {
    badge: shadowRoot.querySelector<HTMLElement>(".mini-apty-badge"),
    highlight: shadowRoot.querySelector<HTMLElement>(".mini-apty-highlight"),
    shield: shadowRoot.querySelector<HTMLElement>(".mini-apty-capture-shield"),
  };
};

const ensureOverlayRoot = () => {
  const existing = document.getElementById(ROOT_ID);

  if (existing?.shadowRoot) {
    return existing.shadowRoot;
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

  const shield = document.createElement("div");
  shield.className = "mini-apty-capture-shield";

  shadowRoot.append(style, shield, highlight, badge);

  return shadowRoot;
};

const setBadgeText = (text: string) => {
  const { badge } = getOverlayElements();

  if (badge) {
    badge.textContent = text;
  }
};

const setBadgeRecording = (recording: boolean) => {
  const { badge } = getOverlayElements();

  badge?.classList.toggle("recording", recording);
};

const setCaptureShieldVisible = (visible: boolean) => {
  const { shield } = getOverlayElements();

  if (shield) {
    shield.style.display = visible ? "block" : "none";
  }
};

const sendRuntimeMessage = (message: RuntimeMessage) => {
  void chrome.runtime.sendMessage(message).catch(() => undefined);
};

const updateHighlight = (element: HTMLElement | null) => {
  const { highlight } = getOverlayElements();

  highlightedElement = element;

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

const clearCaptureHighlight = () => {
  highlightedElement = null;
  lastPointerPosition = null;

  if (highlightFrame) {
    window.cancelAnimationFrame(highlightFrame);
    highlightFrame = 0;
  }

  updateHighlight(null);
};

const scheduleHighlightUpdate = () => {
  if (highlightFrame) {
    return;
  }

  highlightFrame = window.requestAnimationFrame(() => {
    highlightFrame = 0;

    if (!isCapturing || !lastPointerPosition) {
      updateHighlight(null);
      return;
    }

    updateHighlight(
      getCapturableElementAt(lastPointerPosition.x, lastPointerPosition.y),
    );
  });
};

const isOverlayElement = (element: Element | null) => {
  return Boolean(element?.closest?.(`#${ROOT_ID}`));
};

const isElementVisible = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none"
  );
};

const isUsefulFallbackElement = (element: HTMLElement) => {
  const tagName = element.tagName.toLowerCase();

  return tagName !== "html" && tagName !== "body" && isElementVisible(element);
};

const getInteractiveAncestor = (element: HTMLElement | null) => {
  if (!element || isOverlayElement(element)) {
    return null;
  }

  return element.closest<HTMLElement>(CAPTURABLE_SELECTOR);
};

const getCapturableElementAt = (x: number, y: number) => {
  const { shield } = getOverlayElements();
  const previousShieldDisplay = shield?.style.display;

  if (shield) {
    shield.style.display = "none";
  }

  const elementAtPoint = document.elementFromPoint(x, y);

  if (shield) {
    shield.style.display = previousShieldDisplay ?? "block";
  }

  if (!(elementAtPoint instanceof HTMLElement)) {
    return null;
  }

  const interactiveElement = getInteractiveAncestor(elementAtPoint);

  if (interactiveElement && isElementVisible(interactiveElement)) {
    return interactiveElement;
  }

  let current: HTMLElement | null = elementAtPoint;

  while (current && !isUsefulFallbackElement(current)) {
    current = current.parentElement;
  }

  return current;
};

const getElementText = (element: HTMLElement) => {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return trimText(
      element.getAttribute("aria-label") ??
        element.placeholder ??
        element.value ??
        element.name,
    );
  }

  return trimText(
    element.getAttribute("aria-label") ?? element.innerText ?? element.textContent,
  );
};

const getRole = (element: HTMLElement) => {
  const explicitRole = element.getAttribute("role");

  if (explicitRole) {
    return explicitRole;
  }

  const tagName = element.tagName.toLowerCase();

  if (tagName === "button") {
    return "button";
  }

  if (tagName === "a") {
    return "link";
  }

  if (tagName === "select") {
    return "combobox";
  }

  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") {
      return element.type;
    }

    return "textbox";
  }

  if (tagName === "textarea") {
    return "textbox";
  }

  return undefined;
};

const getStableAttributes = (element: HTMLElement) => {
  return STABLE_ATTRIBUTES.reduce<Record<string, string>>((attributes, name) => {
    const value = element.getAttribute(name);

    if (value) {
      attributes[name] = value;
    }

    return attributes;
  }, {});
};

const getNthOfType = (element: HTMLElement) => {
  let index = 1;
  let sibling = element.previousElementSibling;

  while (sibling) {
    if (sibling.tagName === element.tagName) {
      index += 1;
    }

    sibling = sibling.previousElementSibling;
  }

  return index;
};

const buildDomPath = (element: HTMLElement) => {
  const parts: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.documentElement) {
    const tagName = current.tagName.toLowerCase();
    parts.unshift(`${tagName}:nth-of-type(${getNthOfType(current)})`);
    current = current.parentElement;
  }

  return `html > ${parts.join(" > ")}`;
};

const getCandidateSelectors = (element: HTMLElement) => {
  const tagName = element.tagName.toLowerCase();
  const selectors: string[] = [];

  for (const attribute of STABLE_ATTRIBUTES) {
    const value = element.getAttribute(attribute);

    if (!value) {
      continue;
    }

    if (attribute === "id") {
      selectors.push(`#${CSS.escape(value)}`);
      continue;
    }

    selectors.push(
      `${tagName}[${attribute}="${escapeSelectorValue(value)}"]`,
      `[${attribute}="${escapeSelectorValue(value)}"]`,
    );
  }

  const role = getRole(element);
  const text = getElementText(element);

  if (role) {
    selectors.push(`${tagName}[role="${escapeSelectorValue(role)}"]`);
  }

  if (text && text.length <= 60) {
    selectors.push(tagName);
  }

  selectors.push(buildDomPath(element));

  return [...new Set(selectors)];
};

const getPreferredSelector = (candidateSelectors: string[]) => {
  const usableSelector = candidateSelectors.find((selector) => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  });

  return usableSelector ?? candidateSelectors[0] ?? "body";
};

const getStrategy = (
  selector: string,
  element: HTMLElement,
): ElementPointer["strategy"] => {
  if (selector.startsWith("#")) {
    return "id-selector";
  }

  if (selector === buildDomPath(element)) {
    return "dom-path";
  }

  if (selector.includes("[")) {
    return "attribute-selector";
  }

  return "css-selector";
};

const buildElementPointer = (element: HTMLElement): ElementPointer => {
  const candidateSelectors = getCandidateSelectors(element);
  const selector = getPreferredSelector(candidateSelectors);
  const text = getElementText(element);

  return {
    strategy: getStrategy(selector, element),
    selector,
    candidateSelectors,
    fallbackPath: buildDomPath(element),
    ...(text ? { text, textFingerprint: text.toLowerCase() } : {}),
    ...(getRole(element) ? { role: getRole(element) } : {}),
    tagName: element.tagName.toLowerCase(),
    attributes: getStableAttributes(element),
  };
};

const createCapturedStep = (element: HTMLElement): CapturedStep => {
  const text = getElementText(element);

  return {
    id: crypto.randomUUID(),
    title: text ? `Step for ${text}` : "New step",
    description: "Describe what the user should do here.",
    element: buildElementPointer(element),
    advanceTrigger: element.matches("input, textarea, select")
      ? "input-change"
      : "next-button",
  };
};

const handlePointerMove = (event: PointerEvent) => {
  if (!isCapturing) {
    return;
  }

  lastPointerPosition = {
    x: event.clientX,
    y: event.clientY,
  };
  scheduleHighlightUpdate();
};

const stopEvent = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
};

const handlePointerDownCapture = (event: PointerEvent) => {
  if (!isCapturing) {
    return;
  }

  if (event.button !== 0) {
    stopEvent(event);
    return;
  }

  const element =
    getCapturableElementAt(event.clientX, event.clientY) ?? highlightedElement;

  if (!element) {
    stopEvent(event);
    return;
  }

  stopEvent(event);
  updateHighlight(element);

  const message: RuntimeMessage = {
    type: "MINI_APTY_ELEMENT_CAPTURED",
    step: createCapturedStep(element),
  };

  sendRuntimeMessage(message);
  setBadgeText("Step captured. Pick another element.");
  clearCaptureHighlight();
};

const handleBlockedCaptureEvent = (event: Event) => {
  if (isCapturing) {
    stopEvent(event);
  }
};

const handlePointerOut = (event: PointerEvent) => {
  if (!isCapturing) {
    return;
  }

  const relatedTarget = event.relatedTarget;

  if (
    !relatedTarget ||
    !(relatedTarget instanceof Node) ||
    !document.documentElement.contains(relatedTarget)
  ) {
    clearCaptureHighlight();
  }
};

const handleWindowBlur = () => {
  if (isCapturing) {
    clearCaptureHighlight();
  }
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (isCapturing && event.key === "Escape") {
    stopEvent(event);
    stopCapture();
  }
};

const startCapture = () => {
  if (isCapturing) {
    return;
  }

  clearCaptureHighlight();
  isCapturing = true;
  setBadgeText("Recording: click an element. Esc to stop.");
  setBadgeRecording(true);
  setCaptureShieldVisible(true);
  window.addEventListener("pointermove", handlePointerMove, true);
  window.addEventListener("pointerdown", handlePointerDownCapture, true);
  BLOCKED_CAPTURE_EVENTS.filter((eventName) => eventName !== "pointerdown").forEach(
    (eventName) => {
      window.addEventListener(eventName, handleBlockedCaptureEvent, true);
    },
  );
  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("pointerout", handlePointerOut, true);
  window.addEventListener("blur", handleWindowBlur, true);
  window.addEventListener("scroll", scheduleHighlightUpdate, true);
  window.addEventListener("resize", scheduleHighlightUpdate, true);
};

const stopCapture = () => {
  isCapturing = false;
  clearCaptureHighlight();
  setBadgeText("Mini Apty ready");
  setBadgeRecording(false);
  setCaptureShieldVisible(false);
  window.removeEventListener("pointermove", handlePointerMove, true);
  window.removeEventListener("pointerdown", handlePointerDownCapture, true);
  BLOCKED_CAPTURE_EVENTS.filter((eventName) => eventName !== "pointerdown").forEach(
    (eventName) => {
      window.removeEventListener(eventName, handleBlockedCaptureEvent, true);
    },
  );
  window.removeEventListener("keydown", handleKeyDown, true);
  window.removeEventListener("pointerout", handlePointerOut, true);
  window.removeEventListener("blur", handleWindowBlur, true);
  window.removeEventListener("scroll", scheduleHighlightUpdate, true);
  window.removeEventListener("resize", scheduleHighlightUpdate, true);
  sendRuntimeMessage({
    type: "MINI_APTY_CAPTURE_STOPPED",
  });
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
      startCapture();
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
