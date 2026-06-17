# Mini Apty

Mini Apty is a Chrome extension plus backend for recording, saving, and playing lightweight walkthroughs on web pages.

## Prerequisites

- Node.js 22. The project was personally tested with Node.js `v22.22.1`.
- pnpm. The workspace expects pnpm `^11.6.0`.
- Docker, for the local PostgreSQL database.
- Google Chrome or a Chromium-based browser.

## Start The Project After Cloning

1. Install dependencies from the repository root:

   ```bash
   pnpm install
   ```

2. Create the server environment file:

   ```bash
   cp .env.example.server server/.env
   ```

3. Create the extension environment file:

   ```bash
   cp .env.example.extension extension/.env
   ```

4. Start PostgreSQL with Docker:

   ```bash
   docker compose up -d
   ```

5. Start the backend server:

   ```bash
   pnpm --filter server dev
   ```

   The server runs on `http://localhost:3000` by default.

6. Build the extension:

   ```bash
   pnpm --filter extension build
   ```

7. Load the extension in Chrome:
   - Open `chrome://extensions`.
   - Enable **Developer mode**.
   - Click **Load unpacked**.
   - Select the generated `extension/dist` folder.

8. Use the app:
   - Make sure the backend server is still running.
   - Open the extension side panel.
   - Create a new user account.
   - Start recording and saving walkthroughs.

## Key Caveats And Tradeoffs

### Capture And Targeting

Captured steps do not store a DOM node, because DOM nodes disappear after refreshes and SPA rerenders. Instead, each step stores an `ElementPointer`: a preferred selector, candidate selectors, fallback DOM path, text fingerprint, role, tag name, and stable attributes.

```ts
type ElementPointer = {
  selector: string;
  candidateSelectors: string[];
  fallbackPath: string;
  textFingerprint?: string;
  role?: string;
  tagName?: string;
  attributes?: Record<string, string>;
};
```

The capture strategy prefers stable attributes such as `data-testid`, `aria-label`, `name`, `id`, and `placeholder`, then keeps a DOM path as a last fallback.

Replay does not trust the first selector match. It scores visible candidates by tag, role, attributes, and text/label similarity:

```ts
if (step.element.tagName === element.tagName.toLowerCase()) score += 2;
if (step.element.role === getRole(element)) score += 3;
if (element.getAttribute(name) === value) score += 2;
score += getTextMatchScore(expectedText, searchableText);
```

This is more robust than a single `querySelector`, especially on apps like Jira, but it is still heuristic. If the page changes too much, playback may show "target not found" instead of risking a wrong highlight.

### Balloon Positioning

The walkthrough balloon is rendered from the content script inside a Shadow DOM overlay to reduce CSS conflicts with the host page. The target is scrolled into view, then Floating UI positions the balloon near it:

```ts
target.scrollIntoView({ block: "center", inline: "nearest" });

const { x, y } = await computePosition(target, popover, {
  placement: "bottom-start",
  strategy: "fixed",
  middleware: [offset(10), flip({ padding: 12 }), shift({ padding: 12 })],
});
```

`flip` and `shift` keep the balloon inside the viewport when the target is near an edge. If a modal or SPA screen renders late, playback retries briefly before showing a target-not-found message.

### Late Targets And SPA Screens

Modern apps often mount modals and fields after the initial click/route change. Playback waits up to a short timeout and retries target resolution before failing:

```ts
const isWaitingForTarget =
  !target && getActiveStepWaitElapsed() < TARGET_WAIT_TIMEOUT_MS;
```

This improves Jira-style modal playback, but the timeout is intentionally bounded so broken steps fail clearly.

### Refresh Persistence

Content-script memory is lost on page refresh, so playback progress is stored as URL + walkthrough + step index + timestamp. On reload, the content script restores playback only if the URL still matches and the session has not expired.

```ts
startPlayback(session.walkthrough, getPlaybackOptions(), session.stepIndex);
```

This recreates the overlay after refresh. The current implementation is URL-scoped, not tab-scoped.

### Network And Cache Behavior

The backend is the source of truth. Walkthroughs are cached per signed-in user and page after successful loads, and the cache is used when the backend is unreachable.

This keeps preview usable during network failure, but offline writes are not queued. Save/delete failures are shown to the user instead.

### Backend Persistence

The backend uses PostgreSQL with TypeORM. Raw SQL queries would give more control and visibility over joins/indexes, but TypeORM kept the implementation faster for this assignment while still using a real persistent store.

Walkthroughs are scoped to the authenticated user through JWT auth and backend authorization checks, so one user cannot read/update/delete another user's walkthroughs.

### Extension State

The side panel owns authoring state, auth state, saved walkthrough lists, and backend communication. The content script owns page-specific work such as element capture, overlay rendering, target resolution, and playback.

This split keeps DOM-heavy logic close to the page and React-heavy UI logic in the side panel. The tradeoff is more Chrome message passing between the two.

### MV3 Service Worker

The service worker is intentionally small and event-based. It opens/configures the side panel, while DOM capture/playback stays in the content script:

```ts
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

This avoids relying on long-lived service-worker memory, which is not guaranteed under Manifest V3.

## Notes

- The extension talks to the backend using `VITE_API_BASE_URL` from `extension/.env`.
- The backend reads database and JWT settings from `server/.env`.
- The local database runs on host port `5433` based on `docker-compose.yaml`.
- The backend package is currently named `server`, so the workspace command is `pnpm --filter server dev`.
