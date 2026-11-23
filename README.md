# Carbon Labs

> Self-hosted private Chromium desktop workspaces with persistent per-user volume storage and in-browser embedding.

Carbon Labs allows users to create their own dedicated, web-accessible [linuxserver/chromium](https://docs.linuxserver.io/images/docker-chromium/) container directly from their dashboard.

---

## Features

- **Direct Docker Management via Node.js (`dockerode`)**: Containers are created, inspected, started, stopped, and removed via the Docker socket (`/var/run/docker.sock`) without shell commands.
- **Per-User Bind Volumes**: Each user's browser profile, bookmarks, and downloads are stored in a dedicated bind mount folder organized by their user UUID (`volumes/<userUUID>`).
- **Auto-Join on Ready**: Starting or creating a container polls its internal web port and automatically opens the full-screen browser once it is responsive.
- **Full-Screen Browser View**:
  - Embedded desktop with high-performance audio/canvas streaming (via KasmVNC/WebSocket).
  - Clean top control bar to refresh the browser view or exit back to the dashboard.
- **Session Lifecycle Controls**:
  - **Start / Join**: Boots the container and attaches to the session.
  - **Stop**: Stops the running container while safely preserving all user files and profile data in `volumes/<userUUID>`.
  - **Remove**: Stops and deletes the container, and permanently removes the user's `volumes/<userUUID>` folder.
- **Authenticated Reverse Proxy**: Express proxies HTTP and WebSocket connections to the user's specific container port on `127.0.0.1` after verifying session credentials.

---

## Prerequisites

- **Node.js** (v20+ or v22+)
- **MongoDB** running locally (or via Docker)
- **Docker Engine** running and accessible via `/var/run/docker.sock`

---

## Quick Start

### 1. Start MongoDB

If you don't have MongoDB installed natively, start it via Docker:

```bash
docker run -d --name mongo -p 27017:27017 -v mongo_data:/data/db mongo:7
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure `SESSION_SECRET` is set (e.g. `openssl rand -hex 32`).

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Application

```bash
npm run dev
```

- Open `http://localhost:5173` in your browser.
- Create an account on `/signup` or log in on `/`.
- On your dashboard, click **Create & start browser**!

---

## How it Works

```text
[ Browser ] ──▶ [ Vite :5173 / Express :3001 ]
                        │
                        ├── Auth & Session Store (MongoDB)
                        │
                        ├── Dockerode (/var/run/docker.sock)
                        │     └── Spawns 'chromium-<userUUID>'
                        │         - Port 3000 -> 127.0.0.1:<randomPort>
                        │         - Bind: volumes/<userUUID> -> /config
                        │
                        └── http-proxy (HTTP + WebSockets)
                              └── Streams KasmVNC into full-screen iframe
```

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | Express API port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/carbon-labs` | MongoDB connection string |
| `SESSION_SECRET` | *(Required)* | Secret key for session signing |
| `CHROMIUM_IMAGE` | `lscr.io/linuxserver/chromium:latest` | LinuxServer Chromium Docker image |
| `VOLUMES_DIR` | `<projectRoot>/volumes` | Base directory on host for per-user UUID bind volumes |
| `DOCKER_SOCKET_PATH` | `/var/run/docker.sock` | Path to Docker UNIX domain socket |
| `DOCKER_PROXY_HOST` | `127.0.0.1` | Host address for container port binding |
