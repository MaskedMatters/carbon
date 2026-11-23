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
import { DockerManager } from "./dockerManager.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/carbon-labs";
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

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  return next();
}

async function getReqUserUuid(req) {
  if (req.session.userUuid) return req.session.userUuid;
  const user = await User.findById(req.session.userId);
  if (!user) return null;
  if (!user.uuid) {
    user.uuid = crypto.randomUUID();
    await user.save();
  }
  req.session.userUuid = user.uuid;
  return user.uuid;
}

app.get("/api/healthz", (req, res) => res.json({ ok: true }));

app.post(
  "/api/auth/signup",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword =
      typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!usernamePattern.test(username)) {
      return res.status(400).json({
        error: "Username must be 3–24 characters and use only letters, numbers, underscores, or hyphens.",
      });
    }
    const passwordBytes = Buffer.byteLength(password, "utf8");
    if (passwordBytes < 8 || passwordBytes > maxPasswordBytes) {
      return res.status(400).json({ error: "Password must be between 8 and 72 bytes." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const usernameNormalized = username.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    const userUuid = crypto.randomUUID();

    let user;
    try {
      user = await User.create({
        uuid: userUuid,
        username,
        usernameNormalized,
        passwordHash,
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ error: "That username is already taken." });
      }
      throw error;
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.userId = user.id;
    req.session.userUuid = user.uuid;
    await new Promise((resolve, reject) => {
      req.session.save((error) => (error ? reject(error) : resolve()));
    });

    return res.status(201).json({ user: { username: user.username, uuid: user.uuid } });
  }),
);

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

    return res.json({ user: { username: user.username, uuid: user.uuid } });
  }),
);

app.get(
  "/api/auth/me",
  asyncHandler(async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const user = await User.findById(req.session.userId).select("username uuid");
    if (!user) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    if (!user.uuid) {
      user.uuid = crypto.randomUUID();
      await user.save();
    }
    req.session.userUuid = user.uuid;

    return res.json({ user: { username: user.username, uuid: user.uuid } });
  }),
);

app.post(
  "/api/auth/logout",
  asyncHandler(async (req, res) => {
    await new Promise((resolve, reject) => {
      req.session.destroy((error) => (error ? reject(error) : resolve()));
    });
    res.clearCookie("carbon.sid", { httpOnly: true, sameSite: "lax", secure: isProduction });
    return res.status(204).end();
  }),
);

// Container lifecycle endpoints
app.get(
  "/api/container",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userUuid = await getReqUserUuid(req);
    if (!userUuid) {
      return res.status(401).json({ error: "User not found." });
    }
    const containerStatus = await dockerManager.getStatus(userUuid);
    return res.json({ container: containerStatus });
  }),
);

app.post(
  "/api/container/start",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userUuid = await getReqUserUuid(req);
    if (!userUuid) {
      return res.status(401).json({ error: "User not found." });
    }
    const result = await dockerManager.start(userUuid);
    return res.json({ container: result });
  }),
);

app.post(
  "/api/container/stop",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userUuid = await getReqUserUuid(req);
    if (!userUuid) {
      return res.status(401).json({ error: "User not found." });
    }
    const result = await dockerManager.stop(userUuid);
    return res.json({ container: result });
  }),
);

app.post(
  "/api/container/remove",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userUuid = await getReqUserUuid(req);
    if (!userUuid) {
      return res.status(401).json({ error: "User not found." });
    }
    const result = await dockerManager.remove(userUuid);
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

    const userUuid = await getReqUserUuid(req);
    if (!userUuid) {
      return res.status(401).send("User not found.");
    }
    const target = await dockerManager.getProxyTarget(userUuid);
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
