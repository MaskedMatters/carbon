# Carbon Labs

> Self-hosted private Chromium desktop workspaces with persistent per-user volume storage, role-based administration, sign-up approvals, and live telemetry.

Carbon Labs is packaged as a complete multi-container Docker Compose application comprising the **MongoDB database**, the **Express API backend**, and the **Nginx-powered React frontend**.

---

## Architecture Overview

```text
               [ Host Browser ]
                      │
                      ▼ (Port 8000 / FRONTEND_PORT)
             [ Frontend: Nginx ]
             - Serves React SPA
             - Proxies /api/ and /session/ (WebSockets)
                      │
                      ▼
             [ Backend: Express API ] (Port 3001)
             - Authentication & Session Store (MongoDB)
             - Direct Docker socket integration (/var/run/docker.sock)
             - Reverse proxy to user browser containers
                      │
       ┌──────────────┴──────────────┐
       ▼                             ▼
[ MongoDB Server ]          [ User Chromium Containers ]
(Internal network)          - Created dynamically per user
                            - Isolated on 'carbon-network'
                            - Bind mounts host ./volumes/<userUUID>
                            - Cloudflare DNS (1.1.1.3, 1.0.0.3)
```

---

## Quick Start (Docker Compose)

### 1. Configure `.env`

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Generate a secure `SESSION_SECRET`:

```bash
openssl rand -hex 32
```

Paste the value into `SESSION_SECRET=` in `.env`.

> [!NOTE]
> `MONGO_URI` is **no longer required** in `.env` because MongoDB is managed by Docker Compose on the shared internal network `carbon-network`.

### 2. Launch the Stack

Start all services in detached mode:

```bash
docker compose up --build -d
```

### 3. Access the Application

Open your browser to:

```text
http://localhost:8000
```

*(Or whichever port you set for `FRONTEND_PORT`)*.

1. **Initial Setup**: Complete the `/onboarding` screen to create the primary **Super Admin** account.
2. **Dashboard**: Access your private browser container, real-time message board, user management, and live Docker telemetry!

---

## Managing the Stack

```bash
# View combined logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend

# Stop the application
docker compose down

# Stop the application and purge database data
docker compose down -v
```

---

## Docker Statistics Tab

The Administrator **Docker Stats** tab monitors exclusively the project containers and active user browsers:
- **`carbon-frontend`**: Web client reverse proxy
- **`carbon-backend`**: Node.js API and container manager
- **`carbon-mongo`**: MongoDB document database
- **`chromium-<userUUID>`**: All active user Chromium desktops
- **`volumes/<userUUID>`**: All persistent bind mount volumes on disk

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SESSION_SECRET` | *(Required)* | Secret key used to sign session cookies |
| `FRONTEND_PORT` | `8000` | Exposed public port for the web interface |
| `DOCKER_SOCKET_PATH`| `/var/run/docker.sock` | Path to host Docker UNIX domain socket |
| `HOST_VOLUMES_DIR` | `./volumes` | Absolute or relative host path for user volumes |
| `CHROMIUM_IMAGE` | `lscr.io/linuxserver/chromium:latest` | Chromium container image |
| `CONTAINER_DNS` | `1.1.1.3,1.0.0.3` | DNS servers assigned to user containers |
| `TZ` | `UTC` | Timezone configured inside containers |
