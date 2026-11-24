# Carbon Labs

> Self-hosted private Chromium desktop workspaces with persistent per-user volume storage, role-based administration, sign-up approvals, and live telemetry.

Carbon Labs allows users to launch their own dedicated, web-accessible [linuxserver/chromium](https://docs.linuxserver.io/images/docker-chromium/) container directly inside their browser, equipped with Cloudflare Family DNS (`1.1.1.3`, `1.0.0.3`) and dedicated bind mount storage.

---

## Key Features

### 🚀 Onboarding & Super Admin Setup
- When the database has no users, accessing the platform routes to `/onboarding`.
- The first registered account automatically becomes the permanent **Super Admin**.
- Super Admins are immune to deletion and role modification. Once completed, `/onboarding` is permanently locked.

### 📋 Request-Based Sign Ups & Approval Workflow
- Public registration (`/signup`) features a **"Request sign up"** button.
- Submissions enter `pending` status and do not grant immediate access.
- Admins receive pending requests in the dashboard with username and request timestamp, with one-click **Approve** or **Deny** controls.
- Approved users can immediately log in; denied requests are purged.

### 👥 Comprehensive Admin Suite
- **User Management**: View all users, promote to Admin or demote to User, manually provision pre-approved accounts, and delete users (which automatically cleans up their container and disk volume).
- **Docker & Volume Statistics**: Real-time telemetry displaying running containers (ID, name, owner, status, host port) and preserved user bind directories on disk.

### 📢 Community Message Board
- Platform-wide broadcast board accessible to all authenticated users.
- Admins can compose and broadcast announcements to all users.

### 🟢 Live Active Usage Telemetry
- Distinguishes between containers that are merely running versus users who are **actively viewing/interacting** with their private browser.
- Real-time heartbeat tracking surfaces an active presence count badge on the dashboard.

### ⚙️ User Account Settings
- Every user can independently update their username or change their password from the dashboard.

### 🖥️ Chromium Browser Workspace
- Direct Docker management via Node.js (`dockerode`) over `/var/run/docker.sock`.
- Per-user persistent storage bind-mounted to `volumes/<userUUID>`.
- Auto-join when the container becomes online and responsive.
- Full-screen browser iframe with a thin top bar for refreshing or exiting back to the dashboard.
- Safe lifecycle controls: **Start / Join**, **Stop** (keeps volume data), and **Remove** (deletes container and volume directory).

---

## Getting Started

### 1. Prerequisites
- **Node.js** (v20+ or v22+)
- **MongoDB** running locally or via Docker
- **Docker Engine** running and accessible via `/var/run/docker.sock`

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Set `SESSION_SECRET` to a long secure secret (e.g. `openssl rand -hex 32`).

### 3. Start MongoDB
If using Docker:
```bash
docker run -d --name mongo -p 27017:27017 -v mongo_data:/data/db mongo:7
```

### 4. Run Development Stack
```bash
npm run dev
```
Open `http://localhost:5173`:
1. Follow the **`/onboarding`** prompt to initialize your Super Admin account.
2. Explore your browser workspace, administrative tools, message board, and telemetry!

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | Express API port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/carbon-labs` | MongoDB connection URI |
| `SESSION_SECRET` | *(Required)* | Secret key for signing session cookies |
| `CHROMIUM_IMAGE` | `lscr.io/linuxserver/chromium:latest` | LinuxServer Chromium Docker image |
| `CONTAINER_DNS` | `1.1.1.3,1.0.0.3` | DNS servers assigned to user containers |
| `VOLUMES_DIR` | `<projectRoot>/volumes` | Host directory for user UUID bind mounts |
| `DOCKER_SOCKET_PATH`| `/var/run/docker.sock` | Path to Docker UNIX domain socket |
