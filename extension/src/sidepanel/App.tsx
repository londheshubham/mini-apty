import { useEffect, useState } from "react";

import {
  ContentResponse,
  ExtensionMessage,
  pageContextSchema,
  PageContext,
} from "../shared/messages";
import { useAuthStore } from "../stores/auth.store";
import { AuthorPanel } from "./AuthorPanel";
import { AuthPanel } from "./AuthPanel";

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tab;
};

const canInjectIntoTab = (url?: string) => {
  return Boolean(url?.startsWith("http://") || url?.startsWith("https://"));
};

const getContentScriptFile = () => {
  const [contentScript] = chrome.runtime.getManifest().content_scripts ?? [];
  const [file] = contentScript?.js ?? [];

  if (!file) {
    throw new Error("Content script is not listed in the manifest");
  }

  return file;
};

const injectContentScript = async (tabId: number) => {
  await chrome.scripting.executeScript({
    target: {
      tabId,
    },
    files: [getContentScriptFile()],
  });
};

const sendPageContextMessage = async (tabId: number) => {
  return (await chrome.tabs.sendMessage(tabId, {
    type: "MINI_APTY_GET_PAGE_CONTEXT",
  })) as ContentResponse;
};

const sendContentScriptMessage = async (
  tabId: number,
  message: ExtensionMessage,
) => {
  return (await chrome.tabs.sendMessage(tabId, message)) as ContentResponse;
};

const requestPageContext = async () => {
  const tab = await getActiveTab();

  if (!tab.id) {
    throw new Error("No active tab found");
  }

  if (!canInjectIntoTab(tab.url)) {
    throw new Error("Open an http or https page to use Mini Apty");
  }

  let response: ContentResponse;

  try {
    response = await sendPageContextMessage(tab.id);
  } catch {
    await injectContentScript(tab.id);
    response = await sendPageContextMessage(tab.id);
  }

  if (!response.ok || !("pageContext" in response)) {
    throw new Error(response.ok ? "Invalid content response" : response.error);
  }

  return pageContextSchema.parse(response.pageContext);
};

const sendCaptureCommand = async (
  type: "MINI_APTY_START_CAPTURE" | "MINI_APTY_STOP_CAPTURE",
) => {
  const tab = await getActiveTab();

  if (!tab.id) {
    throw new Error("No active tab found");
  }

  if (!canInjectIntoTab(tab.url)) {
    throw new Error("Open an http or https page to use Mini Apty");
  }

  let response: ContentResponse;

  try {
    response = await sendContentScriptMessage(tab.id, { type });
  } catch {
    await injectContentScript(tab.id);
    response = await sendContentScriptMessage(tab.id, { type });
  }

  if (!response.ok) {
    throw new Error(response.error);
  }
};

export const App = () => {
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [status, setStatus] = useState("Loading current tab...");
  const [isLoading, setIsLoading] = useState(false);
  const loadSession = useAuthStore((state) => state.loadSession);

  const loadPageContext = async () => {
    setIsLoading(true);
    setStatus("Connecting to this page...");

    try {
      const context = await requestPageContext();

      setPageContext(context);
      setStatus("Connected to this page");
    } catch (error: unknown) {
      setPageContext(null);
      setStatus(
        error instanceof Error ? error.message : "Could not connect to this page",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPageContext();
    void loadSession();
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Mini Apty</p>
          <h1>Extension shell</h1>
        </div>
        <span className="status-pill">{status}</span>
      </header>

      <section className="panel-section">
        <h2>Current page</h2>
        {pageContext ? (
          <dl className="page-context">
            <div>
              <dt>Origin</dt>
              <dd>{pageContext.origin}</dd>
            </div>
            <div>
              <dt>Path</dt>
              <dd>{pageContext.pathname}</dd>
            </div>
          </dl>
        ) : (
          <div className="empty-state">
            <p className="muted">
              Open any http or https page to test the content script handshake.
              If the tab was already open, click Retry.
            </p>
            <button type="button" onClick={loadPageContext} disabled={isLoading}>
              {isLoading ? "Retrying..." : "Retry"}
            </button>
          </div>
        )}
      </section>

      <AuthPanel />

      <AuthorPanel
        pageContext={pageContext}
        onStartCapture={() => sendCaptureCommand("MINI_APTY_START_CAPTURE")}
        onStopCapture={() => sendCaptureCommand("MINI_APTY_STOP_CAPTURE")}
      />
    </main>
  );
};
