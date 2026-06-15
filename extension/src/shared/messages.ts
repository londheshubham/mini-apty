import { z } from "zod";

export const pageContextSchema = z.object({
  href: z.string().url(),
  origin: z.string().url(),
  pathname: z.string(),
});

export type PageContext = z.infer<typeof pageContextSchema>;

export type ExtensionMessage =
  | {
      type: "MINI_APTY_GET_PAGE_CONTEXT";
    }
  | {
      type: "MINI_APTY_PING";
    };

export type ContentResponse =
  | {
      ok: true;
      pageContext: PageContext;
    }
  | {
      ok: true;
      message: "pong";
    }
  | {
      ok: false;
      error: string;
    };
