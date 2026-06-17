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

## Notes

- The extension talks to the backend using `VITE_API_BASE_URL` from `extension/.env`.
- The backend reads database and JWT settings from `server/.env`.
- The local database runs on host port `5433` based on `docker-compose.yaml`.
- The backend package is currently named `server`, so the workspace command is `pnpm --filter server dev`.
