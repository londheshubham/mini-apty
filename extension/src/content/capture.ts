import { RuntimeMessage } from "../shared/messages";
import { createCapturedStep } from "./element-pointer";
import {
  getOverlayElements,
  isElementVisible,
  isOverlayElement,
  setBadgeRecording,
  setBadgeText,
  setCaptureShieldVisible,
  updateHighlight,
} from "./overlay";

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

type CaptureOptions = {
  sendRuntimeMessage: (message: RuntimeMessage) => void;
  stopPlayback: () => void;
};

let isCapturing = false;
let highlightedElement: HTMLElement | null = null;
let lastPointerPosition: { x: number; y: number } | null = null;
let highlightFrame = 0;
let captureOptions: CaptureOptions | null = null;

export const isCaptureActive = () => isCapturing;

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

const clearCaptureHighlight = () => {
  highlightedElement = null;
  lastPointerPosition = null;

  if (highlightFrame) {
    window.cancelAnimationFrame(highlightFrame);
    highlightFrame = 0;
  }

  updateHighlight(null);
};

const setHighlightedElement = (element: HTMLElement | null) => {
  highlightedElement = element;
  updateHighlight(element);
};

const scheduleHighlightUpdate = () => {
  if (highlightFrame) {
    return;
  }

  highlightFrame = window.requestAnimationFrame(() => {
    highlightFrame = 0;

    if (!isCapturing || !lastPointerPosition) {
      setHighlightedElement(null);
      return;
    }

    setHighlightedElement(
      getCapturableElementAt(lastPointerPosition.x, lastPointerPosition.y),
    );
  });
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
  setHighlightedElement(element);

  captureOptions?.sendRuntimeMessage({
    type: "MINI_APTY_ELEMENT_CAPTURED",
    step: createCapturedStep(element),
  });
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

export const startCapture = (options: CaptureOptions) => {
  if (isCapturing) {
    return;
  }

  captureOptions = options;
  options.stopPlayback();
  clearCaptureHighlight();
  isCapturing = true;
  setBadgeText("Recording: click an element.");
  setBadgeRecording(true);
  setCaptureShieldVisible(true);
  window.addEventListener("pointermove", handlePointerMove, true);
  window.addEventListener("pointerdown", handlePointerDownCapture, true);
  BLOCKED_CAPTURE_EVENTS.filter((eventName) => eventName !== "pointerdown").forEach(
    (eventName) => {
      window.addEventListener(eventName, handleBlockedCaptureEvent, true);
    },
  );
  window.addEventListener("pointerout", handlePointerOut, true);
  window.addEventListener("blur", handleWindowBlur, true);
  window.addEventListener("scroll", scheduleHighlightUpdate, true);
  window.addEventListener("resize", scheduleHighlightUpdate, true);
};

export const stopCapture = () => {
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
  window.removeEventListener("pointerout", handlePointerOut, true);
  window.removeEventListener("blur", handleWindowBlur, true);
  window.removeEventListener("scroll", scheduleHighlightUpdate, true);
  window.removeEventListener("resize", scheduleHighlightUpdate, true);
  captureOptions?.sendRuntimeMessage({
    type: "MINI_APTY_CAPTURE_STOPPED",
  });
};
