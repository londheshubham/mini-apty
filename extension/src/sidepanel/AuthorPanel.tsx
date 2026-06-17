import { useEffect, useState } from "react";

import {
  AdvanceTrigger,
  PageContext,
  RuntimeMessage,
} from "../shared/messages";
import { createWalkthrough, updateWalkthrough } from "../api/walkthroughs";
import { cacheWalkthrough } from "../storage/walkthrough-cache.storage";
import { useAuthStore } from "../stores/auth.store";
import { useRecordingStore } from "../stores/recording.store";

type AuthorPanelProps = {
  pageContext: PageContext | null;
  onStartCapture: () => Promise<void>;
  onStopCapture: () => Promise<void>;
};

const advanceTriggers: { label: string; value: AdvanceTrigger }[] = [
  {
    label: "Next button",
    value: "next-button",
  },
  {
    label: "Click target",
    value: "click-target",
  },
  {
    label: "Input change",
    value: "input-change",
  },
];

const getDefaultWalkthroughName = (pageContext: PageContext | null) => {
  if (!pageContext) {
    return "New walkthrough";
  }

  return pageContext.pathname === "/"
    ? "Home page walkthrough"
    : `Walkthrough - ${pageContext.pathname}`;
};

export const AuthorPanel = ({
  pageContext,
  onStartCapture,
  onStopCapture,
}: AuthorPanelProps) => {
  const token = useAuthStore((state) => state.token);
  const {
    addStep,
    clearSteps,
    deleteStep,
    error,
    setError,
    startRecording,
    status,
    steps,
    stopRecording,
    updateStep,
  } = useRecordingStore();
  const [isToggling, setIsToggling] = useState(false);
  const [walkthroughName, setWalkthroughName] = useState(
    getDefaultWalkthroughName(pageContext),
  );
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedWalkthroughId, setSavedWalkthroughId] = useState<string | null>(
    null,
  );

  const isRecording = status === "recording";
  const canSave =
    Boolean(token) &&
    Boolean(pageContext) &&
    steps.length > 0 &&
    !isRecording &&
    saveStatus !== "saving";

  useEffect(() => {
    setWalkthroughName(getDefaultWalkthroughName(pageContext));
    setSaveStatus("idle");
    setSaveError(null);
    setSavedWalkthroughId(null);
  }, [pageContext?.origin, pageContext?.pathname]);

  useEffect(() => {
    const handleMessage = (message: RuntimeMessage) => {
      if (message.type === "MINI_APTY_ELEMENT_CAPTURED") {
        addStep(message.step);
        setSaveStatus("idle");
        setSaveError(null);
      }

      if (message.type === "MINI_APTY_CAPTURE_STOPPED") {
        stopRecording();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [addStep, stopRecording]);

  const handleStart = async () => {
    setIsToggling(true);

    try {
      await onStartCapture();
      startRecording();
    } catch (captureError: unknown) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : "Could not start recording",
      );
    } finally {
      setIsToggling(false);
    }
  };

  const handleStop = async () => {
    setIsToggling(true);

    try {
      await onStopCapture();
      stopRecording();
    } catch (captureError: unknown) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : "Could not stop recording",
      );
    } finally {
      setIsToggling(false);
    }
  };

  const handleSave = async () => {
    if (!token || !pageContext || steps.length === 0) {
      return;
    }

    setSaveStatus("saving");
    setSaveError(null);

    try {
      const input = {
        name: walkthroughName.trim() || getDefaultWalkthroughName(pageContext),
        origin: pageContext.origin,
        pathPattern: pageContext.pathname,
        steps,
      };
      const walkthrough = savedWalkthroughId
        ? await updateWalkthrough(token, savedWalkthroughId, input)
        : await createWalkthrough(token, input);

      await cacheWalkthrough(walkthrough);

      setSaveStatus("saved");
      setSavedWalkthroughId(walkthrough.id);
    } catch (saveErrorUnknown: unknown) {
      setSaveStatus("error");
      setSaveError(
        saveErrorUnknown instanceof Error
          ? saveErrorUnknown.message
          : "Could not save walkthrough",
      );
    }
  };

  return (
    <section className="panel-section author-panel">
      <div className="author-header">
        <div>
          <h2>Author mode</h2>
          <p className="muted">
            {pageContext
              ? `${pageContext.origin}${pageContext.pathname}`
              : "Connect to a page before recording."}
          </p>
        </div>
        <button
          type="button"
          className={isRecording ? "secondary-button" : "primary-button"}
          disabled={!pageContext || isToggling}
          onClick={isRecording ? handleStop : handleStart}
        >
          {isRecording ? "Stop" : "Record"}
        </button>
      </div>

      {error ? (
        <div className="error-box">
          <strong>Capture error</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {steps.length === 0 ? (
        <p className="muted">Recorded steps will appear here.</p>
      ) : (
        <>
          <label className="walkthrough-name-field">
            Walkthrough name
            <input
              type="text"
              value={walkthroughName}
              onChange={(event) => {
                setWalkthroughName(event.currentTarget.value);
                setSaveStatus("idle");
                setSaveError(null);
              }}
            />
          </label>

          <div className="step-list">
            {steps.map((step, index) => (
              <article className="step-editor" key={step.id}>
                <div className="step-editor-header">
                  <span>Step {index + 1}</span>
                  <button
                    type="button"
                    className="text-button danger-button"
                    onClick={() => {
                      deleteStep(step.id);
                      setSaveStatus("idle");
                      setSaveError(null);
                    }}
                  >
                    Delete
                  </button>
                </div>

                <label>
                  Title
                  <input
                    type="text"
                    value={step.title}
                    onChange={(event) => {
                      updateStep(step.id, {
                        title: event.currentTarget.value,
                      });
                      setSaveStatus("idle");
                      setSaveError(null);
                    }}
                  />
                </label>

                <label>
                  Description
                  <textarea
                    rows={3}
                    value={step.description}
                    onChange={(event) => {
                      updateStep(step.id, {
                        description: event.currentTarget.value,
                      });
                      setSaveStatus("idle");
                      setSaveError(null);
                    }}
                  />
                </label>

                <label>
                  Advance trigger
                  <select
                    value={step.advanceTrigger}
                    onChange={(event) => {
                      updateStep(step.id, {
                        advanceTrigger:
                          event.currentTarget.value as AdvanceTrigger,
                      });
                      setSaveStatus("idle");
                      setSaveError(null);
                    }}
                  >
                    {advanceTriggers.map((trigger) => (
                      <option key={trigger.value} value={trigger.value}>
                        {trigger.label}
                      </option>
                    ))}
                  </select>
                </label>

                <dl className="target-summary">
                  <div>
                    <dt>Target</dt>
                    <dd>{step.element.selector}</dd>
                  </div>
                  <div>
                    <dt>Strategy</dt>
                    <dd>{step.element.strategy}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </>
      )}

      {steps.length > 0 ? (
        <div className="author-actions">
          <button
            type="button"
            className="primary-button"
            disabled={!canSave}
            onClick={handleSave}
          >
            {saveStatus === "saving" ? "Saving..." : "Save walkthrough"}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              clearSteps();
              setSaveStatus("idle");
              setSaveError(null);
              setSavedWalkthroughId(null);
            }}
          >
            Clear steps
          </button>
        </div>
      ) : null}

      {!token ? (
        <p className="muted">Sign in before saving this walkthrough.</p>
      ) : null}

      {isRecording && steps.length > 0 ? (
        <p className="muted">Stop recording before saving.</p>
      ) : null}

      {saveStatus === "saved" ? (
        <p className="success-text">Saved walkthrough.</p>
      ) : null}

      {saveStatus === "error" && saveError ? (
        <div className="error-box">
          <strong>Save error</strong>
          <span>{saveError}</span>
        </div>
      ) : null}
    </section>
  );
};
