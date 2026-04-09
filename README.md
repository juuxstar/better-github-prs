# GitHub PR Dashboard

A web app that authenticates with your GitHub account and displays your open pull requests in a kanban-style board.

## Features

- **GitHub Device Flow Authentication** — sign in via a one-time code, no callback URLs or client secrets
- **Team-based PR Board** — Alpha Review, Beta Review, Your Review, Waiting on Checks, Ready to Merge columns
- **Team Filter** — switch between Alpha, Beta, and Gamma teams with persisted selection
- **Rich PR Details** — labels with colors, CI check squares, Cursor bot comment indicators, size dots, conflict badges
- **Drag-and-Drop** — reorder PRs within a section or move them between sections (auto-updates labels)
- **Create PR** — create new PRs from recent branches directly in the dashboard
- **Checks Polling** — automatically monitors pending CI checks and moves PRs to "Ready to Merge" when they pass
- **Draft View** — toggle between ready PRs and drafts
- **Dark Theme** — GitHub-inspired dark UI

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite, class components via `vue-facing-decorator`, Vue Single File Components
- **Server**: Express + `http-proxy-middleware`, proxies all GitHub API and OAuth calls
- **Auth**: GitHub Device Flow through the Express server, token stored in `localStorage`

## Setup

### 1. Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the form:
    - **Application name**: `GitHub PR Dashboard`
    - **Homepage URL**: `http://localhost:5173`
    - **Authorization callback URL**: `http://localhost:5173` (not actually used by the device flow)
4. Click **"Register application"**
5. Note your **Client ID**
6. Scroll down, check **"Enable Device Flow"**, and save

### 2. Configure the Client ID

Open `src/server/index.ts` and replace the `CLIENT_ID` constant with your own:

```typescript
const CLIENT_ID = "YOUR_GITHUB_CLIENT_ID";
```

### 3. Install and Run

```bash
npm install
npm run dev
```

This starts both the Vite dev server (port 5173) and the Express API proxy (port 3002). Open `http://localhost:5173` in your browser.

### 4. Production Build

```bash
npm run build    # builds frontend to dist/
npm start        # runs Express serving dist/ + API proxy
```

## Project Structure

```
githubPR/
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  eslint.config.js
  src/
    server/
      index.ts                   Express: OAuth proxy + GitHub API proxy + static serving
    client/
      index.html                 Vite SPA entry point
      main.ts                    Creates Vue app, registers components, mounts
      App.vue                    Root component — auth flow, data fetching, polling
      env.d.ts                   TypeScript shims
      assets/
        dashboard.css            All styles (GitHub dark theme)
      lib/
        githubClient.ts          GitHub REST + GraphQL client, caches
        icons.ts                 SVG icon definitions
      services/
        auth.ts                  Device flow auth via /api/auth/* endpoints
      components/
        AppHeader.vue            Header with repo select, type filter, team select, user info
        AuthScreen.vue           Sign-in screen
        CreatePrSection.vue      Create PRs from recent branches
        DeviceScreen.vue         Device code verification UI
        ErrorScreen.vue          Error display with retry
        LoadingScreen.vue        Loading spinner
        PrBoard.vue              Main board layout, PR categorization, drag-and-drop
        PrColumn.vue             Reusable column with drag-and-drop support
        PrItem.vue               Single PR card with labels, checks, stats
        RateLimitBanner.vue      Rate limit warning banner
        ...
```

## Architecture

```
Browser (Vite SPA)              Express Server               GitHub
┌──────────────────┐     ┌────────────────────────┐    ┌──────────────┐
│  App.vue         │     │  POST /api/auth/*      │───>│ OAuth Device │
│  GitHubClient.ts │────>│  ALL  /api/github/*    │───>│ REST + GQL   │
│  auth.ts         │     │  Static dist/ serving  │    │ api.github.com│
└──────────────────┘     └────────────────────────┘    └──────────────┘
```

All GitHub API calls go through the Express proxy at `/api/github/*`, which forwards the `Authorization` header to `api.github.com`. OAuth device flow calls go through `/api/auth/*`.

## Scripts

| Command             | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start Vite dev server + Express server concurrently  |
| `npm run build`     | Build frontend to `dist/`                            |
| `npm start`         | Run Express serving `dist/` + API proxy (production) |
| `npm run typecheck` | Run `vue-tsc` type checking                          |

## Security Notes

- Only the `CLIENT_ID` is configured server-side — no client secret needed for device flow
- The token is stored in the browser's `localStorage`
- The Express server proxies requests without storing tokens
- The extension requests `read:user` and `repo` scopes

## Troubleshooting

| Issue                         | Solution                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------ |
| "Failed to start device flow" | Verify your Client ID in `src/server/index.ts` and that Device Flow is enabled |
| "The device code has expired" | Codes expire after ~15 minutes — click sign in again                           |
| "Authorization was denied"    | You clicked Cancel on the GitHub page — try again                              |
| "Session expired"             | Sign out and sign in again                                                     |
| No PRs showing                | Ensure you have open PRs and the `repo` scope was granted                      |
| CORS errors                   | Make sure the Express server is running (`npm run dev` starts both)            |

## License

MIT
