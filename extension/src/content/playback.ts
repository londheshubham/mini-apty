import { computePosition, flip, offset, shift } from "@floating-ui/dom";

import { CapturedStep, WalkthroughPlayback } from "../shared/messages";
import { attachAdvanceTrigger, clearAdvanceTrigger } from "./playback-advance";
import { resolvePlaybackTarget } from "./playback-target";
import {
  getOverlayElements,
  setBadgeText,
  updateHighlight,
} from "./overlay";

const ADVANCE_TRIGGER_HINTS = {
  "click-target": "Click the highlighted target to continue.",
  "input-change": "Change the highlighted field to continue.",
  "next-button": "Click Next to continue.",
} satisfies Record<CapturedStep["advanceTrigger"], string>;
const TARGET_WAIT_TIMEOUT_MS = 3000;
const TARGET_RETRY_INTERVAL_MS = 150;

type PlaybackOptions = {
  isCaptureActive: () => boolean;
  stopCapture: () => void;
};

let activePlayback: {
  walkthrough: WalkthroughPlayback;
  stepIndex: number;
} | null = null;
let playbackFrame = 0;
let targetRetryTimer = 0;
let activeStepWaitKey = "";
let activeStepWaitStartedAt = 0;

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

const clearTargetRetry = () => {
  if (!targetRetryTimer) {
    return;
  }

  window.clearTimeout(targetRetryTimer);
  targetRetryTimer = 0;
};

const getActiveStepWaitElapsed = () => {
  return Date.now() - activeStepWaitStartedAt;
};

const syncActiveStepWait = (
  walkthrough: WalkthroughPlayback,
  stepIndex: number,
  step: CapturedStep,
) => {
  const stepKey = `${walkthrough.id}:${step.id}:${stepIndex}`;

  if (activeStepWaitKey === stepKey) {
    return;
  }

  activeStepWaitKey = stepKey;
  activeStepWaitStartedAt = Date.now();
};

const scheduleTargetRetry = () => {
  if (targetRetryTimer || !activePlayback) {
    return;
  }

  targetRetryTimer = window.setTimeout(() => {
    targetRetryTimer = 0;
    showPlaybackStep();
  }, TARGET_RETRY_INTERVAL_MS);
};

const getActiveStep = () => {
  if (!activePlayback) {
    return null;
  }

  return activePlayback.walkthrough.steps[activePlayback.stepIndex] ?? null;
};

const showPlaybackStep = () => {
  if (!activePlayback) {
    return;
  }

  clearTargetRetry();
  clearAdvanceTrigger();

  const { popover } = getOverlayElements();
  const { stepIndex, walkthrough } = activePlayback;
  const step = walkthrough.steps[stepIndex];
  syncActiveStepWait(walkthrough, stepIndex, step);

  if (!popover) {
    return;
  }

  const target = resolvePlaybackTarget(step);
  const isWaitingForTarget =
    !target && getActiveStepWaitElapsed() < TARGET_WAIT_TIMEOUT_MS;

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

  if (isWaitingForTarget) {
    const pending = document.createElement("p");
    pending.className = "mini-apty-popover-warning";
    pending.textContent = "Waiting for the target to appear...";
    body.append(pending);
  } else if (!target) {
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
  attachAdvanceTrigger(step, target, {
    advancePlayback,
    getActiveStep,
    resolveTarget: resolvePlaybackTarget,
  });
  schedulePlaybackUpdate();

  if (isWaitingForTarget) {
    scheduleTargetRetry();
  }
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

const updatePlaybackPlacement = () => {
  if (!activePlayback) {
    return;
  }

  const step = activePlayback.walkthrough.steps[activePlayback.stepIndex];
  const { popover } = getOverlayElements();
  const target = resolvePlaybackTarget(step);

  updateHighlight(target);

  if (target) {
    attachAdvanceTrigger(step, target, {
      advancePlayback,
      getActiveStep,
      resolveTarget: resolvePlaybackTarget,
    });
  }

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

  clearTargetRetry();
  clearAdvanceTrigger();
  activePlayback = null;
  activeStepWaitKey = "";
  activeStepWaitStartedAt = 0;

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
