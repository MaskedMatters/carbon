import "dotenv/config";
import bcrypt from "bcryptjs";
import cookieSignature from "cookie-signature";
import MongoStore from "connect-mongo";
import express from "express";
import http from "node:http";
import session from "express-session";
import httpProxy from "http-proxy";
import mongoose from "mongoose";
import crypto from "node:crypto";
import User from "./models/User.js";
import Message from "./models/Message.js";
import { DockerManager } from "./dockerManager.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const mongoUri =
  process.env.MONGO_URI ||
  (process.env.DOCKER_CONTAINER
    ? "mongodb://mongo:27017/carbon-labs"
    : "mongodb://127.0.0.1:27017/carbon-labs");
const sessionSecret = process.env.SESSION_SECRET;
const isProduction = process.env.NODE_ENV === "production";

if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set in the environment.");
}

const dockerManager = new DockerManager();
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
  xfwd: true,
});

const sessionStore = MongoStore.create({
  mongoUrl: mongoUri,
  collectionName: "sessions",
});

app.use(express.json({ limit: "10kb" }));
if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(
  session({
    name: "carbon.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction ? "auto" : false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const usernamePattern = /^[a-zA-Z0-9_-]{3,24}$/;
const maxPasswordBytes = 72;

async function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  const user = await User.findById(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: "User session expired or user not found." });
  }
  req.user = user;
  return next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin" && req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Access denied: Administrator privileges required." });
  }
  return next();
}

function validateCredentials(username, password, confirmPassword = null) {
  if (!usernamePattern.test(username)) {
    return "Username must be 3–24 characters and use only letters, numbers, underscores, or hyphens.";
  }
  const passwordBytes = Buffer.byteLength(password, "utf8");
  if (passwordBytes < 8 || passwordBytes > maxPasswordBytes) {
    return "Password must be between 8 and 72 bytes.";
  }
  if (confirmPassword !== null && password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

app.get("/api/healthz", (req, res) => res.json({ ok: true }));

// System status - checks if initial superadmin onboarding is needed
app.get(
  "/api/system/status",
  asyncHandler(async (req, res) => {
    const userCount = await User.countDocuments();
    return res.json({ onboardingRequired: userCount === 0 });
  }),
);

// Onboarding: Initial setup for the first account (Super Admin)
app.post(
  "/api/auth/onboarding",
  asyncHandler(async (req, res) => {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return res.status(403).json({ error: "Onboarding has already been completed." });
    }

    const body = req.body ?? {};
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword =
      typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    const validationError = validateCredentials(username, password, confirmPassword);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const usernameNormalized = username.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    const userUuid = crypto.randomUUID();

    const user = await User.create({
      uuid: userUuid,
      username,
      usernameNormalized,
      passwordHash,
      role: "superadmin",
      status: "approved",
    });

    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.userId = user.id;
    req.session.userUuid = user.uuid;
    await new Promise((resolve, reject) => {
      req.session.save((error) => (error ? reject(error) : resolve()));
    });

    return res.status(201).json({
      user: {
        username: user.username,
        uuid: user.uuid,
        role: user.role,
        isSuperAdmin: true,
      },
    });
  }),
);

// Public signup: requests sign up, requires admin approval
app.post(
  "/api/auth/signup",
  asyncHandler(async (req, res) => {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      return res.status(400).json({
        error: "No administrator exists yet. Please complete initial onboarding first.",
      });
    }

    const body = req.body ?? {};
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword =
      typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    const validationError = validateCredentials(username, password, confirmPassword);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const usernameNormalized = username.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    const userUuid = crypto.randomUUID();

    try {
      await User.create({
        uuid: userUuid,
        username,
        usernameNormalized,
        passwordHash,
        role: "user",
        status: "pending",
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ error: "That username is already taken or requested." });
      }
      throw error;
    }

    return res.status(201).json({
      pending: true,
      message:
        "You request to sign up has been submitted. Try to log in periodically until you are able to access the dashboard.",
    });
  }),
);

// User login
app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = await User.findOne({ usernameNormalized: username.toLowerCase() });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "The username or password is incorrect." });
    }

    if (user.status === "pending") {
      return res.status(403).json({
        error:
          "Your account is pending administrator approval. Please wait for an administrator to approve your request.",
      });
    }

    if (user.status === "rejected") {
      return res.status(403).json({
        error:
          "Your account request was not approved. Please contact an administrator.",
      });
    }

    if (!user.uuid) {
      user.uuid = crypto.randomUUID();
      await user.save();
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.userId = user.id;
    req.session.userUuid = user.uuid;
    await new Promise((resolve, reject) => {
      req.session.save((error) => (error ? reject(error) : resolve()));
    });

    return res.json({
      user: {
        username: user.username,
        uuid: user.uuid,
        role: user.role,
        isSuperAdmin: user.role === "superadmin",
      },
    });
  }),
);

// Current user profile
app.get(
  "/api/auth/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    return res.json({
      user: {
        username: user.username,
        uuid: user.uuid,
        role: user.role,
        isSuperAdmin: user.role === "superadmin",
      },
    });
  }),
);

// Logout
app.post(
  "/api/auth/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { lastActiveAt: null });
    await new Promise((resolve, reject) => {
      req.session.destroy((error) => (error ? reject(error) : resolve()));
    });
    res.clearCookie("carbon.sid", { httpOnly: true, sameSite: "lax", secure: isProduction });
    return res.status(204).end();
  }),
);

// Presence update - active browser session usage
app.post(
  "/api/presence",
  requireAuth,
  asyncHandler(async (req, res) => {
    const active = Boolean(req.body?.active);
    await User.findByIdAndUpdate(req.user._id, {
      lastActiveAt: active ? new Date() : null,
    });
    return res.json({ ok: true });
  }),
);

// Active statistics (users actively viewing/using the browser within last 45s)
app.get(
  "/api/stats/active",
  requireAuth,
  asyncHandler(async (req, res) => {
    const threshold = new Date(Date.now() - 45000);
    const activeUsers = await User.find({
      lastActiveAt: { $gte: threshold },
    }).select("username lastActiveAt");

    return res.json({
      count: activeUsers.length,
      activeUsers: activeUsers.map((u) => ({
        username: u.username,
        lastActiveAt: u.lastActiveAt,
      })),
    });
  }),
);

// Account Settings: Change username
app.post(
  "/api/user/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    if (!usernamePattern.test(username)) {
      return res.status(400).json({
        error: "Username must be 3–24 characters and use only letters, numbers, underscores, or hyphens.",
      });
    }

    const usernameNormalized = username.toLowerCase();
    const existing = await User.findOne({
      usernameNormalized,
      _id: { $ne: req.user._id },
    });
    if (existing) {
      return res.status(409).json({ error: "That username is already taken." });
    }

    req.user.username = username;
    req.user.usernameNormalized = usernameNormalized;
    await req.user.save();

    return res.json({
      user: {
        username: req.user.username,
        uuid: req.user.uuid,
        role: req.user.role,
        isSuperAdmin: req.user.role === "superadmin",
      },
      message: "Username updated successfully.",
    });
  }),
);

// Account Settings: Change password
app.post(
  "/api/user/password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    const confirmNewPassword =
      typeof req.body?.confirmNewPassword === "string" ? req.body.confirmNewPassword : "";

    if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }

    const validationError = validateCredentials(req.user.username, newPassword, confirmNewPassword);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    req.user.passwordHash = await bcrypt.hash(newPassword, 12);
    await req.user.save();

    return res.json({ ok: true, message: "Password updated successfully." });
  }),
);

// Message Board: Get messages
app.get(
  "/api/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const messages = await Message.find().sort({ createdAt: -1 }).limit(50);
    return res.json({ messages });
  }),
);

// Message Board: Create message (Admin only)
app.post(
  "/api/messages",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required." });
    }

    const message = await Message.create({
      authorUsername: req.user.username,
      authorId: req.user._id,
      title,
      content,
    });

    return res.status(201).json({ message });
  }),
);

// Message Board: Delete message (Admin only)
app.delete(
  "/api/messages/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await Message.findByIdAndDelete(req.params.id);
    return res.json({ ok: true });
  }),
);

// Admin: Get pending sign up requests
app.get(
  "/api/admin/signups",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const requests = await User.find({ status: "pending" })
      .select("username createdAt uuid")
      .sort({ createdAt: -1 });
    return res.json({ requests });
  }),
);

// Admin: Approve a sign up request
app.post(
  "/api/admin/signups/:id/approve",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: "Registration request not found." });
    }
    targetUser.status = "approved";
    await targetUser.save();
    return res.json({ ok: true, message: `Approved ${targetUser.username}.` });
  }),
);

// Admin: Deny a sign up request
app.post(
  "/api/admin/signups/:id/deny",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: "Registration request not found." });
    }
    // Remove user and any clean up
    await dockerManager.remove(targetUser.uuid);
    await User.findByIdAndDelete(targetUser._id);
    return res.json({ ok: true, message: `Denied and removed request for ${targetUser.username}.` });
  }),
);

// Admin: Get all users
app.get(
  "/api/admin/users",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await User.find()
      .select("username uuid role status createdAt lastActiveAt")
      .sort({ createdAt: -1 });
    return res.json({ users });
  }),
);

// Admin: Manually create a user
app.post(
  "/api/admin/users",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "admin" ? "admin" : "user";

    const validationError = validateCredentials(username, password);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const usernameNormalized = username.toLowerCase();
    const existing = await User.findOne({ usernameNormalized });
    if (existing) {
      return res.status(409).json({ error: "That username is already taken." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userUuid = crypto.randomUUID();

    const created = await User.create({
      uuid: userUuid,
      username,
      usernameNormalized,
      passwordHash,
      role,
      status: "approved",
    });

    return res.status(201).json({
      user: {
        id: created.id,
        uuid: created.uuid,
        username: created.username,
        role: created.role,
        status: created.status,
      },
    });
  }),
);

// Admin: Update user role (promote/demote)
app.patch(
  "/api/admin/users/:id/role",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    if (targetUser.role === "superadmin") {
      return res.status(403).json({ error: "The Super Admin role cannot be modified." });
    }

    const nextRole = req.body?.role === "admin" ? "admin" : "user";
    targetUser.role = nextRole;
    await targetUser.save();

    return res.json({ ok: true, user: { username: targetUser.username, role: targetUser.role } });
  }),
);

// Admin: Delete user
app.delete(
  "/api/admin/users/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    if (targetUser.role === "superadmin") {
      return res.status(403).json({ error: "The Super Admin cannot be deleted." });
    }

    // Stop and remove container, delete bind volume
    await dockerManager.remove(targetUser.uuid);
    await User.findByIdAndDelete(targetUser._id);

    return res.json({ ok: true, message: `User ${targetUser.username} has been deleted.` });
  }),
);

// Admin: Docker and volume statistics
app.get(
  "/api/admin/docker",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await User.find().select("uuid username");
    const usersMap = Object.fromEntries(users.map((u) => [u.uuid, u.username]));
    const stats = await dockerManager.getDockerStats(usersMap);
    return res.json(stats);
  }),
);

// Container lifecycle endpoints
app.get(
  "/api/container",
  requireAuth,
  asyncHandler(async (req, res) => {
    const containerStatus = await dockerManager.getStatus(req.user.uuid);
    return res.json({ container: containerStatus });
  }),
);

app.post(
  "/api/container/start",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await dockerManager.start(req.user.uuid);
    return res.json({ container: result });
  }),
);

app.post(
  "/api/container/stop",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await dockerManager.stop(req.user.uuid);
    return res.json({ container: result });
  }),
);

app.post(
  "/api/container/remove",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await dockerManager.remove(req.user.uuid);
    return res.json({ container: result });
  }),
);

// Proxy HTTP requests for Chromium session
app.use(
  "/session",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.originalUrl === "/session") {
      return res.redirect(301, "/session/");
    }

    const target = await dockerManager.getProxyTarget(req.user.uuid);
    if (!target) {
      return res.status(409).send("Start or join your Chromium container first.");
    }
    proxy.web(req, res, { target }, (error) => {
      console.error("[Proxy] Could not proxy Chromium request:", error);
      if (!res.headersSent) {
        res.status(502).send("The Chromium session is temporarily unavailable.");
      } else {
        res.destroy(error);
      }
    });
  }),
);

function getSessionIdFromCookie(req) {
  const cookieHeader = req.headers.cookie ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("carbon.sid="))
    ?.slice("carbon.sid=".length);

  if (!sessionCookie) return null;

  let decoded;
  try {
    decoded = decodeURIComponent(sessionCookie);
  } catch {
    return null;
  }
  if (!decoded.startsWith("s:")) return null;
  return cookieSignature.unsign(decoded.slice(2), sessionSecret);
}

const server = http.createServer(app);

// Handle WebSocket proxying for KasmVNC
server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/session" && !req.url?.startsWith("/session/")) {
    socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
    return;
  }

  const sessionId = getSessionIdFromCookie(req);
  if (!sessionId) {
    socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
    return;
  }

  sessionStore.get(sessionId, async (error, storedSession) => {
    if (error || !storedSession?.userId) {
      socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
      return;
    }

    try {
      let userUuid = storedSession.userUuid;
      if (!userUuid) {
        const user = await User.findById(storedSession.userId).select("uuid");
        userUuid = user?.uuid;
      }
      if (!userUuid) {
        socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
        return;
      }

      const target = await dockerManager.getProxyTarget(userUuid);
      if (!target) {
        socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
        return;
      }

      const parsedUrl = new URL(req.url, "http://localhost");
      parsedUrl.pathname = parsedUrl.pathname.slice("/session".length) || "/";
      req.url = `${parsedUrl.pathname}${parsedUrl.search}`;

      proxy.ws(req, socket, head, { target }, (wsError) => {
        console.error("[Proxy] Chromium WebSocket error:", wsError);
        socket.destroy();
      });
    } catch (err) {
      console.error("[Proxy] Upgrade error:", err);
      socket.end("HTTP/1.1 500 Internal Server Error\r\n\r\n");
    }
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    return next(error);
  }
  const status =
    Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 500
      ? error.statusCode
      : 500;
  return res.status(status).json({
    error:
      error?.userMessage ??
      (status < 500 ? error.message : "Something went wrong. Please try again."),
  });
});

try {
  await mongoose.connect(mongoUri);
  server.listen(port, () => {
    console.log(`Carbon Labs API listening on http://localhost:${port}`);
  });
} catch (error) {
  console.error("Could not connect to MongoDB:", error);
  process.exitCode = 1;
}

let isShuttingDown = false;
async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Server] Received ${signal}. Saving and stopping active browser containers...`);

  try {
    await dockerManager.stopAllActiveContainers();
  } catch (err) {
    console.error("[Server] Error saving containers during shutdown:", err);
  }

  server.close(() => {
    mongoose.connection
      .close(false)
      .then(() => {
        console.log("[Server] Graceful shutdown complete.");
        process.exit(0);
      })
      .catch(() => process.exit(0));
  });

  // Failsafe timeout after 25s
  setTimeout(() => {
    console.warn("[Server] Forced shutdown timeout reached.");
    process.exit(0);
  }, 25000);
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

