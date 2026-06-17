import { create } from "zustand";

import { AdvanceTrigger, CapturedStep } from "../shared/messages";

type RecordingStatus = "idle" | "recording" | "error";

type RecordingState = {
  status: RecordingStatus;
  steps: CapturedStep[];
  error: string | null;
  startRecording: () => void;
  stopRecording: () => void;
  addStep: (step: CapturedStep) => void;
  replaceSteps: (steps: CapturedStep[]) => void;
  updateStep: (
    id: string,
    input: Partial<
      Pick<CapturedStep, "title" | "description" | "advanceTrigger">
    >,
  ) => void;
  deleteStep: (id: string) => void;
  clearSteps: () => void;
  setError: (error: string) => void;
};

export const useRecordingStore = create<RecordingState>((set) => ({
  status: "idle",
  steps: [],
  error: null,
  startRecording: () => {
    set({
      status: "recording",
      error: null,
    });
  },
  stopRecording: () => {
    set({
      status: "idle",
      error: null,
    });
  },
  addStep: (step) => {
    set((state) => ({
      steps: [...state.steps, step],
      error: null,
    }));
  },
  replaceSteps: (steps) => {
    set({
      steps,
      error: null,
    });
  },
  updateStep: (id, input) => {
    set((state) => ({
      steps: state.steps.map((step) =>
        step.id === id
          ? {
              ...step,
              ...input,
              advanceTrigger:
                (input.advanceTrigger as AdvanceTrigger | undefined) ??
                step.advanceTrigger,
            }
          : step,
      ),
    }));
  },
  deleteStep: (id) => {
    set((state) => ({
      steps: state.steps.filter((step) => step.id !== id),
    }));
  },
  clearSteps: () => {
    set({
      steps: [],
      error: null,
    });
  },
  setError: (error) => {
    set({
      status: "error",
      error,
    });
  },
}));
