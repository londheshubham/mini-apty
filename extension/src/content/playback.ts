import { computePosition, flip, offset, shift } from "@floating-ui/dom";

import { CapturedStep, WalkthroughPlayback } from "../shared/messages";
import { getRole } from "./element-pointer";
import {
  getOverlayElements,
  isElementVisible,
  isOverlayElement,
  setBadgeText,
  updateHighlight,
} from "./overlay";

const ADVANCE_TRIGGER_HINTS = {
  "click-target": "Click the highlighted target to continue.",
  "input-change": "Change the highlighted field to continue.",
  "next-button": "Click Next to continue.",
} satisfies Record<CapturedStep["advanceTrigger"], string>;

type PlaybackOptions = {
  isCaptureActive: () => boolean;
  stopCapture: () => void;
};

let activePlayback: {
  walkthrough: WalkthroughPlayback;
  stepIndex: number;
} | null = null;
let playbackFrame = 0;
let activeAdvanceCleanup: (() => void) | null = null;

const getVisibleElementsForSelector = (selector: string) => {
  try {
    return [...document.querySelectorAll(selector)].filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        !isOverlayElement(element) &&
        isElementVisible(element),
    );
  } catch {
    return [];
  }
};

const getSearchableElementText = (element: HTMLElement) => {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return (
      element.getAttribute("aria-label") ??
      element.placeholder ??
      element.value ??
      element.name ??
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  return (
    element.getAttribute("aria-label") ??
    element.innerText ??
    element.textContent ??
    ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const getPlaybackTargetScore = (step: CapturedStep, element: HTMLElement) => {
  let score = 0;
  const tagName = element.tagName.toLowerCase();
  const role = getRole(element);
  const text = getSearchableElementText(element);
  const expectedText = (
    step.element.textFingerprint ??
    step.element.text ??
    ""
  ).toLowerCase();

  if (step.element.tagName && step.element.tagName === tagName) {
    score += 2;
  }

  if (step.element.role && step.element.role === role) {
    score += 3;
  }

  if (step.element.attributes) {
    for (const [name, value] of Object.entries(step.element.attributes)) {
      if (element.getAttribute(name) === value) {
        score += 2;
      }
    }
  }

  if (expectedText && text) {
    if (text === expectedText) {
      score += 8;
    } else if (text.includes(expectedText)) {
      score += 6;
    } else if (expectedText.includes(text)) {
      score += 4;
    }
  }

  return score;
};

const hasStrongPlaybackHints = (step: CapturedStep) => {
  return Boolean(
    step.element.textFingerprint ||
      step.element.text ||
      step.element.role ||
      Object.keys(step.element.attributes ?? {}).length > 0,
  );
};

const isBroadPlaybackSelector = (selector: string, matchCount: number) => {
  return /^[a-z][a-z0-9-]*$/i.test(selector.trim()) || matchCount > 5;
};

const resolvePlaybackTarget = (step: CapturedStep) => {
  const selectors = [
    step.element.selector,
    ...step.element.candidateSelectors,
    step.element.fallbackPath,
  ].filter((selector, index, allSelectors) => {
    return Boolean(selector) && allSelectors.indexOf(selector) === index;
  });
  const requiresHints = hasStrongPlaybackHints(step);

  for (const selector of selectors) {
    const elements = getVisibleElementsForSelector(selector);

    if (elements.length === 0) {
      continue;
    }

    const scoredElements = elements
      .map((element) => ({
        element,
        score: getPlaybackTargetScore(step, element),
      }))
      .sort((first, second) => second.score - first.score);
    const bestMatch = scoredElements[0];
    const selectorIsBroad = isBroadPlaybackSelector(selector, elements.length);

    if (bestMatch.score >= 4) {
      return bestMatch.element;
    }

    if (!requiresHints && !selectorIsBroad) {
      return bestMatch.element;
    }
  }

  return null;
};

const positionPlaybackPopover = async (
  target: HTMLElement | null,
  popover: HTMLElement,
) => {
  if (!target) {
    const popoverWidth = popover.offsetWidth || 320;
    const centeredLeft = Math.max((window.innerWidth - popoverWidth) / 2, 12);

    popover.style.left = `${centeredLeft}px`;
    popover.style.top = "12px";
    return;
  }

  const { x, y } = await computePosition(target, popover, {
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [offset(10), flip({ padding: 12 }), shift({ padding: 12 })],
  });

  popover.style.left = `${x}px`;
  popover.style.top = `${y}px`;
};

const createPopoverButton = (
  label: string,
  className: string,
  onClick: () => void,
  disabled = false,
) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (button.disabled) {
      return;
    }

    onClick();
  });

  return button;
};

const clearAdvanceTrigger = () => {
  activeAdvanceCleanup?.();
  activeAdvanceCleanup = null;
};

const showPlaybackStep = () => {
  if (!activePlayback) {
    return;
  }

  clearAdvanceTrigger();

  const { popover } = getOverlayElements();
  const { stepIndex, walkthrough } = activePlayback;
  const step = walkthrough.steps[stepIndex];

  if (!popover) {
    return;
  }

  const target = resolvePlaybackTarget(step);

  if (target) {
    target.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "auto",
    });
  }

  setBadgeText(`Playing: ${walkthrough.name}`);

  const header = document.createElement("div");
  header.className = "mini-apty-popover-header";

  const title = document.createElement("h3");
  title.className = "mini-apty-popover-title";
  title.textContent = step.title;

  const stepCounter = document.createElement("span");
  stepCounter.className = "mini-apty-popover-step";
  stepCounter.textContent = `${stepIndex + 1} of ${walkthrough.steps.length}`;

  header.append(title, stepCounter);

  const body = document.createElement("div");
  body.className = "mini-apty-popover-body";

  const description = document.createElement("p");
  description.className = "mini-apty-popover-description";
  description.textContent = step.description;
  body.append(description);

  const hint = document.createElement("p");
  hint.className = "mini-apty-popover-hint";
  hint.textContent = ADVANCE_TRIGGER_HINTS[step.advanceTrigger];
  body.append(hint);

  if (!target) {
    const warning = document.createElement("p");
    warning.className = "mini-apty-popover-warning";
    warning.textContent = "Target not found on this page.";
    body.append(warning);
  }

  const actions = document.createElement("div");
  actions.className = "mini-apty-popover-actions";

  const isLastStep = stepIndex === walkthrough.steps.length - 1;
  const isFirstStep = stepIndex === 0;
  const stopButton = createPopoverButton(
    "Stop",
    "mini-apty-popover-stop",
    stopPlayback,
  );
  const previousButton = createPopoverButton(
    "Previous",
    "mini-apty-popover-prev",
    () => {
      if (!activePlayback || isFirstStep) {
        return;
      }

      activePlayback = {
        ...activePlayback,
        stepIndex: activePlayback.stepIndex - 1,
      };
      showPlaybackStep();
    },
    isFirstStep,
  );
  const nextButton = createPopoverButton(
    isLastStep ? "Done" : "Next",
    "mini-apty-popover-next",
    () => {
      if (!activePlayback) {
        return;
      }

      if (isLastStep) {
        stopPlayback();
        return;
      }

      activePlayback = {
        ...activePlayback,
        stepIndex: activePlayback.stepIndex + 1,
      };
      showPlaybackStep();
    },
  );

  actions.append(stopButton, previousButton, nextButton);
  body.append(actions);

  popover.replaceChildren(header, body);
  popover.style.display = "block";
  attachAdvanceTrigger(step, target);
  schedulePlaybackUpdate();
};

const advancePlayback = () => {
  if (!activePlayback) {
    return;
  }

  const isLastStep =
    activePlayback.stepIndex === activePlayback.walkthrough.steps.length - 1;

  if (isLastStep) {
    stopPlayback();
    return;
  }

  activePlayback = {
    ...activePlayback,
    stepIndex: activePlayback.stepIndex + 1,
  };
  showPlaybackStep();
};

const attachAdvanceTrigger = (
  step: CapturedStep,
  target: HTMLElement | null,
) => {
  clearAdvanceTrigger();

  if (!target || step.advanceTrigger === "next-button") {
    return;
  }

  let didAdvance = false;
  const handleAdvance = () => {
    if (didAdvance) {
      return;
    }

    didAdvance = true;
    advancePlayback();
  };

  if (step.advanceTrigger === "click-target") {
    target.addEventListener("click", handleAdvance, true);
    activeAdvanceCleanup = () => {
      target.removeEventListener("click", handleAdvance, true);
    };
    return;
  }

  target.addEventListener("input", handleAdvance, true);
  target.addEventListener("change", handleAdvance, true);
  activeAdvanceCleanup = () => {
    target.removeEventListener("input", handleAdvance, true);
    target.removeEventListener("change", handleAdvance, true);
  };
};

const updatePlaybackPlacement = () => {
  if (!activePlayback) {
    return;
  }

  const step = activePlayback.walkthrough.steps[activePlayback.stepIndex];
  const { popover } = getOverlayElements();
  const target = resolvePlaybackTarget(step);

  updateHighlight(target);

  if (popover) {
    void positionPlaybackPopover(target, popover);
  }
};

const schedulePlaybackUpdate = () => {
  if (playbackFrame) {
    return;
  }

  playbackFrame = window.requestAnimationFrame(() => {
    playbackFrame = 0;

    if (!activePlayback) {
      return;
    }

    updatePlaybackPlacement();
  });
};

export const stopPlayback = () => {
  const { popover } = getOverlayElements();

  clearAdvanceTrigger();
  activePlayback = null;

  if (playbackFrame) {
    window.cancelAnimationFrame(playbackFrame);
    playbackFrame = 0;
  }

  if (popover) {
    popover.replaceChildren();
    popover.style.display = "none";
  }

  updateHighlight(null);
  setBadgeText("Mini Apty ready");
  window.removeEventListener("scroll", schedulePlaybackUpdate, true);
  window.removeEventListener("resize", schedulePlaybackUpdate, true);
};

export const startPlayback = (
  walkthrough: WalkthroughPlayback,
  options: PlaybackOptions,
) => {
  if (walkthrough.steps.length === 0) {
    return false;
  }

  if (options.isCaptureActive()) {
    options.stopCapture();
  }

  stopPlayback();
  activePlayback = {
    walkthrough,
    stepIndex: 0,
  };

  window.addEventListener("scroll", schedulePlaybackUpdate, true);
  window.addEventListener("resize", schedulePlaybackUpdate, true);
  showPlaybackStep();

  return true;
};
