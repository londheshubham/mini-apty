import { CapturedStep } from "../shared/messages";

type AdvanceTriggerOptions = {
  advancePlayback: () => void;
  getActiveStep: () => CapturedStep | null;
  resolveTarget: (step: CapturedStep) => HTMLElement | null;
};

let activeAdvanceCleanup: (() => void) | null = null;
let activeAdvanceTarget: HTMLElement | null = null;
let activeAdvanceStepId = "";
let inputAdvanceTimer = 0;

export const clearAdvanceTrigger = () => {
  if (inputAdvanceTimer) {
    window.clearTimeout(inputAdvanceTimer);
    inputAdvanceTimer = 0;
  }

  activeAdvanceCleanup?.();
  activeAdvanceCleanup = null;
  activeAdvanceTarget = null;
  activeAdvanceStepId = "";
};

const isEventFromTarget = (event: Event, target: HTMLElement) => {
  const path = event.composedPath();

  if (path.includes(target)) {
    return true;
  }

  return event.target instanceof Node && target.contains(event.target);
};

export const attachAdvanceTrigger = (
  step: CapturedStep,
  target: HTMLElement | null,
  options: AdvanceTriggerOptions,
) => {
  if (
    target &&
    activeAdvanceTarget === target &&
    activeAdvanceStepId === step.id &&
    step.advanceTrigger !== "next-button"
  ) {
    return;
  }

  clearAdvanceTrigger();

  if (!target || step.advanceTrigger === "next-button") {
    return;
  }

  activeAdvanceTarget = target;
  activeAdvanceStepId = step.id;

  let didAdvance = false;
  const handleAdvance = (event?: Event) => {
    if (didAdvance) {
      return;
    }

    if (event && step.advanceTrigger === "input-change") {
      const activeStep = options.getActiveStep();

      if (activeStep?.id !== step.id) {
        return;
      }

      const currentTarget = options.resolveTarget(activeStep);

      if (!currentTarget || !isEventFromTarget(event, currentTarget)) {
        return;
      }

      if (inputAdvanceTimer) {
        window.clearTimeout(inputAdvanceTimer);
      }

      inputAdvanceTimer = window.setTimeout(() => {
        inputAdvanceTimer = 0;

        if (didAdvance) {
          return;
        }

        didAdvance = true;
        options.advancePlayback();
      }, 250);
      return;
    }

    didAdvance = true;
    options.advancePlayback();
  };

  if (step.advanceTrigger === "click-target") {
    target.addEventListener("click", handleAdvance, true);
    activeAdvanceCleanup = () => {
      target.removeEventListener("click", handleAdvance, true);
    };
    return;
  }

  document.addEventListener("input", handleAdvance, true);
  document.addEventListener("change", handleAdvance, true);
  activeAdvanceCleanup = () => {
    document.removeEventListener("input", handleAdvance, true);
    document.removeEventListener("change", handleAdvance, true);
  };
};
