import Docker from "dockerode";
import fs from "node:fs";
import path from "node:path";

export class DockerManager {
  constructor({
    socketPath = process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
    image = process.env.CHROMIUM_IMAGE || "lscr.io/linuxserver/chromium:latest",
    volumesDir = process.env.VOLUMES_DIR ||
      (process.env.DOCKER_CONTAINER ? "/app/volumes" : path.resolve(process.cwd(), "volumes")),
    hostVolumesDir = process.env.HOST_VOLUMES_DIR ||
      process.env.VOLUMES_DIR ||
      path.resolve(process.cwd(), "volumes"),
    proxyHost = process.env.DOCKER_PROXY_HOST || "127.0.0.1",
    dockerNetwork = process.env.DOCKER_NETWORK ||
      (process.env.DOCKER_CONTAINER ? "carbon-network" : ""),
    dnsServers = process.env.CONTAINER_DNS
      ? process.env.CONTAINER_DNS.split(",").map((s) => s.trim())
      : ["1.1.1.3", "1.0.0.3"],
  } = {}) {
    this.docker = new Docker({ socketPath: socketPath.replace(/^unix:\/\//, "") });
    this.image = image;
    this.volumesDir = volumesDir;
    this.hostVolumesDir = hostVolumesDir;
    this.proxyHost = proxyHost;
    this.dockerNetwork = dockerNetwork;
    this.dnsServers = dnsServers;
    this.operations = new Map();
    this.imagePulled = false;
    this.imageUpdateAvailable = false;
    this.lastImageCheck = 0;
    this.isPullingImage = false;
  }

  getUserVolumeDir(userUuid) {
    return path.join(this.volumesDir, userUuid);
  }

  getUserHostVolumeDir(userUuid) {
    return path.join(this.hostVolumesDir, userUuid);
  }

  getContainerName(userUuid) {
    return `chromium-${userUuid}`;
  }

  async withLock(userUuid, fn) {
    const previous = this.operations.get(userUuid) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    this.operations.set(userUuid, current);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.operations.get(userUuid) === current) {
        this.operations.delete(userUuid);
      }
    }
  }

  async pullImage() {
    if (this.isPullingImage) {
      while (this.isPullingImage) {
        await new Promise((r) => setTimeout(r, 1000));
      }
      return;
    }

    this.isPullingImage = true;
    console.log(`[DockerManager] Pulling latest Chromium image: ${this.image}...`);
    try {
      await new Promise((resolve, reject) => {
        this.docker.pull(this.image, (pullErr, stream) => {
          if (pullErr) return reject(pullErr);
          this.docker.modem.followProgress(stream, (progressErr) =>
            progressErr ? reject(progressErr) : resolve(),
          );
        });
      });
      this.imagePulled = true;
      this.imageUpdateAvailable = false;
      this.lastImageCheck = Date.now();
      console.log(`[DockerManager] Successfully updated Chromium image: ${this.image}`);
    } finally {
      this.isPullingImage = false;
    }
  }

  async checkForImageUpdate(force = true) {
    const now = Date.now();
    if (!force && this.lastImageCheck && now - this.lastImageCheck < 60 * 1000) {
      return { updateAvailable: this.imageUpdateAvailable };
    }
    this.lastImageCheck = now;

    try {
      let localInspect;
      try {
        localInspect = await this.docker.getImage(this.image).inspect();
        this.imagePulled = true;
      } catch (err) {
        if (err?.statusCode === 404) {
          this.imagePulled = false;
          this.imageUpdateAvailable = true;
          return { updateAvailable: true, reason: "Local image not present" };
        }
        throw err;
      }

      // Query registry distribution descriptor via Docker daemon
      const distData = await new Promise((resolve, reject) => {
        this.docker.modem.dial(
          {
            path: `/distribution/${this.image}/json`,
            method: "GET",
            statusCodes: { 200: true },
          },
          (err, data) => (err ? reject(err) : resolve(data)),
        );
      });

      const remoteDigest = distData?.Descriptor?.digest;
      if (!remoteDigest) {
        return { updateAvailable: this.imageUpdateAvailable };
      }

      const localRepoDigests = localInspect.RepoDigests || [];
      const isUpToDate = localRepoDigests.some((rd) => rd.includes(remoteDigest));

      this.imageUpdateAvailable = !isUpToDate;

      return {
        updateAvailable: this.imageUpdateAvailable,
        remoteDigest,
      };
    } catch (err) {
      console.warn(`[DockerManager] Could not verify remote image status: ${err.message}`);
      return { updateAvailable: !this.imagePulled, error: err.message };
    }
  }

  async ensureImage() {
    console.log(`[DockerManager] Checking for Chromium image updates before launching container...`);
    const updateCheck = await this.checkForImageUpdate(true);
    if (updateCheck?.updateAvailable || !this.imagePulled) {
      console.log(`[DockerManager] Newer Chromium image found (or local image missing). Pulling before creating container...`);
      await this.pullImage();
    } else {
      console.log(`[DockerManager] Chromium image is up to date.`);
    }
  }

  async findContainer(userUuid) {
    const name = this.getContainerName(userUuid);
    const container = this.docker.getContainer(name);
    try {
      const info = await container.inspect();
      return { container, info };
    } catch (err) {
      if (err?.statusCode === 404) return null;
      throw err;
    }
  }

  hasSavedData(userUuid) {
    const dir = this.getUserVolumeDir(userUuid);
    return fs.existsSync(dir);
  }

  getHostPort(containerInfo) {
    const bindings = containerInfo.NetworkSettings?.Ports?.["3000/tcp"];
    return bindings?.[0]?.HostPort ? Number(bindings[0].HostPort) : null;
  }

  async isPortReady(userUuid, port) {
    const targetUrl = this.dockerNetwork
      ? `http://${this.getContainerName(userUuid)}:3000/`
      : port
        ? `http://${this.proxyHost}:${port}/`
        : null;

    if (!targetUrl) return false;

    try {
      const res = await fetch(targetUrl, {
        signal: AbortSignal.timeout(2000),
      });
      return res.status < 500;
    } catch {
      return false;
    }
  }

  async getStatus(userUuid) {
    const found = await this.findContainer(userUuid);
    const hasData = this.hasSavedData(userUuid);

    if (!found) {
      return {
        status: hasData ? "stopped" : "not_created",
        hasSavedData: hasData,
        ready: false,
      };
    }

    const isRunning = Boolean(found.info.State?.Running);
    if (!isRunning) {
      return {
        status: "stopped",
        hasSavedData: hasData,
        ready: false,
      };
    }

    const hostPort = this.getHostPort(found.info);
    const ready = await this.isPortReady(userUuid, hostPort);

    return {
      status: ready ? "running" : "starting",
      hasSavedData: hasData,
      ready,
      port: hostPort,
    };
  }

  async waitForReady(userUuid, timeoutMs = 90000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = await this.findContainer(userUuid);
      if (found && found.info.State?.Running) {
        const port = this.getHostPort(found.info);
        if (await this.isPortReady(userUuid, port)) {
          return { ready: true, port };
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Chromium container started, but did not become responsive in time.");
  }

  async start(userUuid) {
    return this.withLock(userUuid, async () => {
      await this.ensureImage();

      // Ensure local bind directory exists
      const userVolumeDir = this.getUserVolumeDir(userUuid);
      await fs.promises.mkdir(userVolumeDir, { recursive: true });

      let found = await this.findContainer(userUuid);

      if (found) {
        if (!found.info.State?.Running) {
          // Stale or stopped container: delete so it is created fresh with the latest image
          try {
            await found.container.remove({ force: true });
          } catch (err) {
            if (err?.statusCode !== 404) throw err;
          }
          found = null;
        } else {
          // Already running!
          const { port } = await this.waitForReady(userUuid);
          return {
            status: "running",
            hasSavedData: true,
            ready: true,
            port,
          };
        }
      }

      const hostConfig = {
        Dns: this.dnsServers,
        Binds: [`${this.getUserHostVolumeDir(userUuid)}:/config`],
        PortBindings: {
          "3000/tcp": [{ HostIp: "127.0.0.1", HostPort: "" }],
        },
        ShmSize: 1024 * 1024 * 1024,
        RestartPolicy: { Name: "no" },
      };

      if (this.dockerNetwork) {
        hostConfig.NetworkMode = this.dockerNetwork;
      }

      const containerInstance = await this.docker.createContainer({
        Image: this.image,
        name: this.getContainerName(userUuid),
        Labels: {
          "carbon.project": "carbon-labs",
          "carbon.user-uuid": userUuid,
        },
        Env: ["PUID=1000", "PGID=1000", `TZ=${process.env.TZ || "UTC"}`],
        ExposedPorts: { "3000/tcp": {} },
        HostConfig: hostConfig,
      });
      await containerInstance.start();

      const { port } = await this.waitForReady(userUuid);
      return {
        status: "running",
        hasSavedData: true,
        ready: true,
        port,
      };
    });
  }

  async stop(userUuid) {
    return this.withLock(userUuid, async () => {
      const found = await this.findContainer(userUuid);
      if (found) {
        if (found.info.State?.Running) {
          try {
            await found.container.stop({ t: 10 });
          } catch (err) {
            if (err?.statusCode !== 304 && err?.statusCode !== 404) throw err;
          }
        }
        try {
          await found.container.remove({ force: true });
        } catch (err) {
          if (err?.statusCode !== 404) throw err;
        }
      }
      return {
        status: "stopped",
        hasSavedData: this.hasSavedData(userUuid),
        ready: false,
      };
    });
  }

  async stopAllActiveContainers() {
    try {
      const rawContainers = await this.docker.listContainers({ all: true });
      const activeChromium = rawContainers.filter((c) => {
        const rawName = (c.Names?.[0] || "").replace(/^\//, "");
        return rawName.startsWith("chromium-") || Boolean(c.Labels?.["carbon.user-uuid"]);
      });

      if (activeChromium.length === 0) return;

      console.log(
        `[DockerManager] Gracefully saving and deleting ${activeChromium.length} browser container(s)...`,
      );

      await Promise.allSettled(
        activeChromium.map(async (c) => {
          const container = this.docker.getContainer(c.Id);
          const name = (c.Names?.[0] || "").replace(/^\//, "");
          try {
            if (c.State === "running") {
              await container.stop({ t: 10 });
            }
            await container.remove({ force: true });
            console.log(`[DockerManager] Saved and removed container: ${name}`);
          } catch (err) {
            if (err?.statusCode !== 304 && err?.statusCode !== 404) {
              console.error(`[DockerManager] Error stopping/removing ${name}:`, err);
            }
          }
        }),
      );
      console.log("[DockerManager] All active user browser containers have been saved and removed.");
    } catch (err) {
      console.error("[DockerManager] Error during shutdown container sweep:", err);
    }
  }

  async remove(userUuid) {
    return this.withLock(userUuid, async () => {
      const found = await this.findContainer(userUuid);
      if (found) {
        if (found.info.State?.Running) {
          try {
            await found.container.stop({ t: 10 });
          } catch (err) {
            if (err?.statusCode !== 304 && err?.statusCode !== 404) throw err;
          }
        }
        try {
          await found.container.remove({ force: true });
        } catch (err) {
          if (err?.statusCode !== 404) throw err;
        }
      }

      // Delete the bind directory for this user
      const userVolumeDir = this.getUserVolumeDir(userUuid);
      try {
        await fs.promises.rm(userVolumeDir, { recursive: true, force: true });
      } catch (err) {
        console.error(`[DockerManager] Could not remove volume dir ${userVolumeDir}:`, err);
      }

      return {
        status: "not_created",
        hasSavedData: false,
        ready: false,
      };
    });
  }

  async getProxyTarget(userUuid) {
    const found = await this.findContainer(userUuid);
    if (!found || !found.info.State?.Running) return null;

    if (this.dockerNetwork) {
      return `http://${this.getContainerName(userUuid)}:3000`;
    }

    const port = this.getHostPort(found.info);
    if (!port) return null;
    return `http://${this.proxyHost}:${port}`;
  }

  async getDockerStats(usersMap = {}) {
    let rawContainers = [];
    try {
      rawContainers = await this.docker.listContainers({ all: true });
    } catch (err) {
      console.error("[DockerManager] Error listing containers:", err);
    }

    const targetServiceNames = new Set(["carbon-mongo", "carbon-backend", "carbon-frontend"]);

    // Filter strictly to:
    // 1) The 3 Compose containers (mongo, backend, frontend)
    // 2) The Chromium containers created for users
    const filteredContainers = rawContainers
      .filter((c) => {
        const rawName = (c.Names?.[0] || "").replace(/^\//, "");
        const isCoreService =
          targetServiceNames.has(rawName) ||
          ["mongo", "backend", "frontend"].includes(c.Labels?.["carbon.service"]);
        const isChromium =
          rawName.startsWith("chromium-") || Boolean(c.Labels?.["carbon.user-uuid"]);

        return isCoreService || isChromium;
      })
      .map((c) => {
        const rawName = (c.Names?.[0] || "").replace(/^\//, "");
        const isCoreService =
          targetServiceNames.has(rawName) ||
          ["mongo", "backend", "frontend"].includes(c.Labels?.["carbon.service"]);
        const userUuid = c.Labels?.["carbon.user-uuid"] || (isCoreService ? null : rawName.replace(/^chromium-/, ""));

        let serviceType = "User Browser";
        let owner = userUuid ? (usersMap[userUuid] || "Unknown User") : "System";

        if (rawName.includes("mongo") || c.Labels?.["carbon.service"] === "mongo") {
          serviceType = "Database (MongoDB)";
          owner = "Core Service";
        } else if (rawName.includes("backend") || c.Labels?.["carbon.service"] === "backend") {
          serviceType = "Backend API";
          owner = "Core Service";
        } else if (rawName.includes("frontend") || c.Labels?.["carbon.service"] === "frontend") {
          serviceType = "Frontend (Nginx)";
          owner = "Core Service";
        }

        const portsDesc =
          c.Ports?.map((p) =>
            p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : `${p.PrivatePort}/tcp`,
          ).join(", ") || "—";

        return {
          id: c.Id.slice(0, 12),
          name: rawName,
          serviceType,
          isCoreService,
          userUuid,
          username: owner,
          state: c.State,
          status: c.Status,
          port: portsDesc,
          created: new Date(c.Created * 1000).toISOString(),
        };
      });

    const volumes = [];
    if (fs.existsSync(this.volumesDir)) {
      try {
        const entries = await fs.promises.readdir(this.volumesDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const userUuid = entry.name;
            const fullPath = path.join(this.volumesDir, userUuid);
            const stats = await fs.promises.stat(fullPath);
            volumes.push({
              userUuid,
              username: usersMap[userUuid] || "Unknown / Deleted User",
              createdAt: stats.birthtime.toISOString(),
              updatedAt: stats.mtime.toISOString(),
            });
          }
        }
      } catch (err) {
        console.error("[DockerManager] Error reading volumes directory:", err);
      }
    }

    return {
      containers: filteredContainers,
      volumes,
      summary: {
        totalContainers: filteredContainers.length,
        runningContainers: filteredContainers.filter((c) => c.state === "running").length,
        totalVolumes: volumes.length,
      },
      imageInfo: {
        image: this.image,
        updateAvailable: this.imageUpdateAvailable,
        lastChecked: this.lastImageCheck ? new Date(this.lastImageCheck).toISOString() : null,
      },
    };
  }
}
