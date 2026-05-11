# PRism

PRism is a web app that authenticates with your GitHub account and displays your open pull requests in a kanban-style board.

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
- **Server**: Express + `http-proxy-middleware`, proxies all GitHub API and device-flow calls
- **Auth**: GitHub Device Flow through the Express server, token stored in `localStorage`

## Setup

### 1. Create a GitHub App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Open **GitHub Apps**
3. Click **"New GitHub App"**
4. Fill in the basic app details:
    - **GitHub App name**: `PRism`
    - **Homepage URL**: `http://localhost:5173`
    - **Callback URL**: `http://localhost:5173` if GitHub asks for one; it is not used by the device flow
5. Disable **Webhook** unless you plan to add webhook handling separately
6. Set repository permissions for the dashboard features you want:
    - **Metadata**: read-only
    - **Contents**: read-only
    - **Pull requests**: read and write
    - **Issues**: read and write
    - **Checks**: read-only
    - **Commit statuses**: read-only
7. Click **"Create GitHub App"**
8. On the app settings page, enable **Device Flow**
9. Install the GitHub App on the repositories or organization you want the dashboard to access
10. Note the app's **Client ID**. This is different from the App ID.

### 2. Configure the Client ID

Set the `GITHUB_CLIENT_ID` environment variable to your GitHub App's Client ID:

```bash
export GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID
```

For local development only, `src/server/index.ts` includes a fallback Client ID.

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

## Docker Production Deployment

The project includes a multi-stage Dockerfile that builds the Vue app, compiles the Express server to JavaScript, and runs the production server as a non-root user in a single container. Build the image locally, upload the image archive to the Ubuntu server, and run it there.

### Build the Image

```bash
docker build -t prism .
```

### Run Locally

```bash
docker run --rm \
  -p 3002:3002 \
  -e GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID \
  prism
```

Open `http://localhost:3002`.

### Deploy to Ubuntu

The image is built locally for `linux/amd64` by default, exported to a compressed Docker archive, uploaded over SSH, loaded on the server, and run there. The default remote application directory is `/home/ubuntu/frontlobby/prism`.

Prerequisites:

- Docker installed locally
- Docker installed on the Ubuntu server
- SSH access to the server
- The remote user can run Docker directly, or can become root with `sudo -E su`

Deploy with the helper script:

```bash
GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID ./scripts/deploy-image.sh user@YOUR_SERVER_IP_OR_DOMAIN
```

By default this:

- Builds `prism:latest` locally for `linux/amd64`
- Creates `/home/ubuntu/frontlobby/prism` on the server
- Uploads the image archive to `/home/ubuntu/frontlobby/prism/prism-latest.tar.gz`
- Loads the image on the server
- Replaces any existing `prism` container
- Runs the app on host port `3002`, mapped to container port `3002`

You can override the defaults:

```bash
GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID \
IMAGE_TAG=2026-05-11 \
TARGET_PLATFORM=linux/amd64 \
HOST_PORT=3003 \
REMOTE_APP_DIR=/home/ubuntu/frontlobby/prism \
./scripts/deploy-image.sh user@YOUR_SERVER_IP_OR_DOMAIN
```

If the remote SSH user cannot run Docker directly, the deploy script automatically falls back to passwordless `sudo -E docker`. If a server requires the whole remote script to run through sudo, enable remote elevation:

```bash
GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID \
REMOTE_USE_SUDO_SU=1 \
./scripts/deploy-image.sh user@YOUR_SERVER_IP_OR_DOMAIN
```

For the FrontLobby testing server, HAProxy should route `prism.dev.frontlobby.com` to the PRism container on `127.0.0.1:3002`. PRism serves plain HTTP on that port, so the backend server line should not use `ssl` unless TLS support is added to PRism itself.

### Manual Image Copy Deployment

The same deployment can be run manually:

```bash
docker build -t prism:latest .
docker save prism:latest | gzip > prism.tar.gz
ssh user@YOUR_SERVER_IP_OR_DOMAIN "mkdir -p /home/ubuntu/frontlobby/prism"
scp prism.tar.gz user@YOUR_SERVER_IP_OR_DOMAIN:/home/ubuntu/frontlobby/prism/prism.tar.gz
ssh user@YOUR_SERVER_IP_OR_DOMAIN "cd /home/ubuntu/frontlobby/prism && docker load < prism.tar.gz"
ssh user@YOUR_SERVER_IP_OR_DOMAIN "docker rm -f prism || true"
ssh user@YOUR_SERVER_IP_OR_DOMAIN "docker run -d \
  --name prism \
  --restart unless-stopped \
  -p 3002:3002 \
  -e GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID \
  prism:latest"
```

### GitHub App for Production

Update the GitHub App settings before public deployment:

- **Homepage URL**: `http://YOUR_SERVER_IP_OR_DOMAIN`
- **Callback URL**: `http://YOUR_SERVER_IP_OR_DOMAIN` if configured
- **Device Flow**: enabled

The app uses GitHub's device flow, so the callback URL is not used by the login flow. Make sure the GitHub App is installed on the repositories or organization you want to manage.

### HTTPS

The single Docker container exposes HTTP. For a real public deployment, put HTTPS in front of it with a host-level reverse proxy, load balancer, or platform proxy, then map that proxy to the container's `3002` port.

## Project Structure

```
PRism/
  Dockerfile
  package.json
  scripts/
    deploy-image.sh             Build locally, upload, load, and run the Docker image
  tsconfig.json
  tsconfig.server.json
  tsconfig.node.json
  vite.config.ts
  eslint.config.js
  src/
    server/
      index.ts                   Express: GitHub App auth proxy + GitHub API proxy + static serving
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
│  App.vue         │     │  POST /api/auth/*      │───>│ Device Flow  │
│  GitHubClient.ts │────>│  ALL  /api/github/*    │───>│ REST + GQL   │
│  auth.ts         │     │  Static dist/ serving  │    │ api.github.com│
└──────────────────┘     └────────────────────────┘    └──────────────┘
```

All GitHub API calls go through the Express proxy at `/api/github/*`, which forwards the `Authorization` header to `api.github.com`. GitHub App device-flow calls go through `/api/auth/*`.

## Scripts

| Command             | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start Vite dev server + Express server concurrently  |
| `npm run build`     | Build frontend to `dist/`                            |
| `npm start`         | Run Express serving `dist/` + API proxy (production) |
| `npm run typecheck` | Run `vue-tsc` type checking                          |

## Security Notes

- Only the GitHub App client ID is configured server-side — no client secret needed for device flow
- The token is stored in the browser's `localStorage`
- The Express server proxies requests without storing tokens
- Repository access is controlled by the GitHub App installation and permissions

## Troubleshooting

| Issue                         | Solution                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------ |
| "Failed to start device flow" | Verify your GitHub App Client ID in `GITHUB_CLIENT_ID` and that Device Flow is enabled |
| "The device code has expired" | Codes expire after ~15 minutes — click sign in again                           |
| "Authorization was denied"    | You clicked Cancel on the GitHub page — try again                              |
| "Session expired"             | Sign out and sign in again                                                     |
| No PRs showing                | Ensure the GitHub App is installed on the repositories and has pull request access |
| CORS errors                   | Make sure the Express server is running (`npm run dev` starts both)            |

## License

MIT
