import { z } from "zod";

export const pageContextSchema = z.object({
  href: z.string().url(),
  origin: z.string().url(),
  pathname: z.string(),
});

export type PageContext = z.infer<typeof pageContextSchema>;

export type AdvanceTrigger = "next-button" | "click-target" | "input-change";

export type ElementPointer = {
  strategy: "attribute-selector" | "id-selector" | "css-selector" | "dom-path";
  selector: string;
  candidateSelectors: string[];
  fallbackPath: string;
  text?: string;
  textFingerprint?: string;
  role?: string;
  tagName?: string;
  attributes?: Record<string, string>;
};

export type CapturedStep = {
  id: string;
  title: string;
  description: string;
  element: ElementPointer;
  advanceTrigger: AdvanceTrigger;
};

export type WalkthroughPlayback = {
  id: string;
  name: string;
  steps: CapturedStep[];
};

export type ExtensionMessage =
  | {
      type: "MINI_APTY_GET_PAGE_CONTEXT";
    }
  | {
      type: "MINI_APTY_PING";
    }
  | {
      type: "MINI_APTY_START_CAPTURE";
    }
  | {
      type: "MINI_APTY_STOP_CAPTURE";
    }
  | {
      type: "MINI_APTY_PLAY_WALKTHROUGH";
      walkthrough: WalkthroughPlayback;
    };

export type RuntimeMessage =
  | {
      type: "MINI_APTY_ELEMENT_CAPTURED";
      step: CapturedStep;
    }
  | {
      type: "MINI_APTY_CAPTURE_STOPPED";
    };

export type ContentResponse =
  | {
      ok: true;
      pageContext: PageContext;
    }
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };
