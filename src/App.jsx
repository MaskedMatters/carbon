import React, { useEffect, useState } from "react";

async function requestApi(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  let result = {};
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    // Non-JSON response
  }
  if (!response.ok) {
    throw new Error(result.error || `Request failed with status ${response.status}`);
  }
  return result;
}

function BrandMark() {
  return (
    <div className="brand" aria-label="Carbon Labs">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-name">carbon labs</span>
    </div>
  );
}

function WelcomePanel({ onboarding }) {
  return (
    <section className="welcome-panel" aria-labelledby="welcome-heading">
      <div className="welcome-copy">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          {onboarding ? "INITIAL SYSTEM SETUP" : "A BETTER WAY FORWARD"}
        </div>
        <h1 id="welcome-heading">
          {onboarding ? (
            <>
              Initialize
              <br />
              <span className="title-highlight">Carbon Labs</span>
              <span className="title-period">.</span>
            </>
          ) : (
            <>
              Welcome to
              <br />
              <span className="title-highlight">Carbon Labs</span>
              <span className="title-period">.</span>
            </>
          )}
        </h1>
        <p className="welcome-description">
          {onboarding
            ? "No accounts exist yet. Complete the onboarding form to create the primary Super Administrator account and configure your platform."
            : "Carbon Labs provides isolated, private Chromium browser desktop containers with dedicated per-user storage and direct web access."}
        </p>
        <div className="welcome-footnote">
          Private Browser <span>·</span> Isolated Volumes <span>·</span> Cloudflare DNS
        </div>
      </div>
    </section>
  );
}

function AuthCard({ mode, onAuthenticated, onNavigate, message, setMessage }) {
  const isSignup = mode === "signup";
  const isOnboarding = mode === "onboarding";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (password !== confirmPassword && (isSignup || isOnboarding)) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = isOnboarding
        ? "/api/auth/onboarding"
        : isSignup
          ? "/api/auth/signup"
          : "/api/auth/login";

      const result = await requestApi(endpoint, {
        method: "POST",
        body: JSON.stringify({ username, password, confirmPassword }),
      });

      if (isSignup && result.pending) {
        setRequestSubmitted(true);
      } else if (result.user) {
        onAuthenticated(result.user);
      }
    } catch (error) {
      setMessage(error.message || "Unable to connect. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (requestSubmitted) {
    return (
      <section className="login-card" aria-labelledby="login-heading">
        <div className="card-kicker">
          <span className="kicker-dot" />
          REQUEST SUBMITTED
        </div>
        <h2 id="login-heading">
          Pending Approval<span>.</span>
        </h2>
        <div className="success-banner" style={{ marginTop: "16px" }}>
          You request to sign up has been submitted. Try to log in periodically until
          you are able to access the dashboard.
        </div>
        <button
          className="submit-button"
          type="button"
          onClick={(e) => {
            setRequestSubmitted(false);
            onNavigate(e, "/");
          }}
        >
          <span>Return to Log in</span>
        </button>
      </section>
    );
  }

  return (
    <section className="login-card" aria-labelledby="login-heading">
      <div className="card-kicker">
        <span className="kicker-dot" />
        {isOnboarding
          ? "SYSTEM INITIALIZATION"
          : isSignup
            ? "REQUEST ACCESS"
            : "YOUR WORKSPACE AWAITS"}
      </div>
      <h2 id="login-heading">
        {isOnboarding ? "Setup Admin" : isSignup ? "Sign up" : "Log in"}
        <span>.</span>
      </h2>
      <p className="card-description">
        {isOnboarding
          ? "Create the primary Super Administrator account."
          : isSignup
            ? "Request access to Carbon Labs. An admin will review your request."
            : "Good to have you back."}
      </p>

      <form className="login-form" onSubmit={handleSubmit}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          placeholder="Your username"
          autoComplete="username"
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9_-]{3,24}"
          title="Use 3–24 letters, numbers, underscores, or hyphens."
          required
        />

        <div className="password-label">
          <label htmlFor="password">Password</label>
          {(isSignup || isOnboarding) && <span>At least 8 characters</span>}
        </div>
        <input
          id="password"
          name="password"
          type="password"
          placeholder={isSignup || isOnboarding ? "Create a password" : "Enter your password"}
          autoComplete={isSignup || isOnboarding ? "new-password" : "current-password"}
          minLength={8}
          required
        />

        {(isSignup || isOnboarding) && (
          <>
            <label className="confirm-password-label" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Enter your password again"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </>
        )}

        {message && (
          <p className="form-message" role="alert">
            {message}
          </p>
        )}

        <button className="submit-button" type="submit" disabled={isSubmitting}>
          <span>
            {isSubmitting
              ? "Please wait..."
              : isOnboarding
                ? "Complete Setup & Launch"
                : isSignup
                  ? "Request sign up"
                  : "Log in to your account"}
          </span>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M4.5 10h11m0 0-4.5-4.5M15.5 10 11 14.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>

      {!isOnboarding && (
        <>
          <div className="divider" aria-label="or">
            <span />
            <span className="divider-word">or</span>
            <span />
          </div>
          <p className="signup-prompt">
            {isSignup ? "Already have an account? " : "New around here? "}
            <a
              href={isSignup ? "/" : "/signup"}
              onClick={(event) => onNavigate(event, isSignup ? "/" : "/signup")}
            >
              {isSignup ? "Log in" : "Continue to sign up"}
            </a>
          </p>
        </>
      )}
    </section>
  );
}

function Dashboard({ user, onUserUpdate }) {
  const isAdmin = user.role === "admin" || user.role === "superadmin";
  const [activeTab, setActiveTab] = useState("workspace");

  // Container state
  const [container, setContainer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [isViewing, setIsViewing] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  // Global & Active Usage Stats
  const [activeStats, setActiveStats] = useState({ count: 0, activeUsers: [] });
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Messages / Announcements
  const [messages, setMessages] = useState([]);
  const [newMessageTitle, setNewMessageTitle] = useState("");
  const [newMessageContent, setNewMessageContent] = useState("");
  const [isPostingMessage, setIsPostingMessage] = useState(false);

  // Admin Data
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [dockerStats, setDockerStats] = useState(null);
  const [manualUsername, setManualUsername] = useState("");
  const [manualPassword, setManualPassword] = useState("");
  const [manualRole, setManualRole] = useState("user");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Account Settings Form State
  const [newUsername, setNewUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Unread messages tracking
  const [lastReadMessageTime, setLastReadMessageTime] = useState(() => {
    return localStorage.getItem(`carbon_last_read_${user.username}`) || "0";
  });

  const unreadMessagesCount = messages.filter(
    (m) => new Date(m.createdAt) > new Date(lastReadMessageTime),
  ).length;

  function handleSelectTab(tabName) {
    setActiveTab(tabName);
    if (tabName === "messages") {
      const now = new Date().toISOString();
      setLastReadMessageTime(now);
      localStorage.setItem(`carbon_last_read_${user.username}`, now);
    }
  }

  // Load container status
  const loadContainer = async () => {
    try {
      const data = await requestApi("/api/container");
      setContainer(data.container);
    } catch (err) {
      // container lookup error
    } finally {
      setIsLoading(false);
    }
  };

  // Load active browser presence
  const loadActiveStats = async () => {
    try {
      const data = await requestApi("/api/stats/active");
      setActiveStats(data);
    } catch {
      // stats error
    }
  };

  // Load message board
  const loadMessages = async () => {
    try {
      const data = await requestApi("/api/messages");
      setMessages(data.messages || []);
    } catch {
      // message load error
    }
  };

  // Load admin pending signups
  const loadPendingSignups = async () => {
    if (!isAdmin) return;
    try {
      const data = await requestApi("/api/admin/signups");
      setPendingRequests(data.requests || []);
    } catch {
      // admin error
    }
  };

  // Load all users
  const loadAllUsers = async () => {
    if (!isAdmin) return;
    try {
      const data = await requestApi("/api/admin/users");
      setAllUsers(data.users || []);
    } catch {
      // admin error
    }
  };

  // Load docker stats
  const loadDockerStats = async () => {
    if (!isAdmin) return;
    try {
      const data = await requestApi("/api/admin/docker");
      setDockerStats(data);
    } catch {
      // docker error
    }
  };

  useEffect(() => {
    loadContainer();
    loadActiveStats();
    loadMessages();
    if (isAdmin) {
      loadPendingSignups();
    }

    const interval = setInterval(() => {
      loadContainer();
      loadActiveStats();
      if (isAdmin) loadPendingSignups();
    }, 12000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // When switching tabs, load tab-specific data
  useEffect(() => {
    if (activeTab === "users") loadAllUsers();
    if (activeTab === "docker") loadDockerStats();
    if (activeTab === "signups") loadPendingSignups();
    if (activeTab === "messages") loadMessages();
    setErrorMessage("");
    setSuccessMessage("");
  }, [activeTab]);

  // Presence heartbeat when viewing the browser
  useEffect(() => {
    if (!isViewing) return;
    const sendPresence = (active) => {
      requestApi("/api/presence", {
        method: "POST",
        body: JSON.stringify({ active }),
      }).catch(() => {});
    };

    sendPresence(document.visibilityState === "visible");
    const interval = setInterval(() => {
      sendPresence(document.visibilityState === "visible");
    }, 15000);
    const onVisChange = () => sendPresence(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisChange);
      sendPresence(false);
    };
  }, [isViewing]);

  // Container actions
  async function handleStart() {
    setBusyAction("start");
    setErrorMessage("");
    try {
      const data = await requestApi("/api/container/start", { method: "POST" });
      setContainer(data.container);
      if (data.container?.ready) {
        setIsViewing(true);
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed to start container.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleStop() {
    setBusyAction("stop");
    setErrorMessage("");
    try {
      const data = await requestApi("/api/container/stop", { method: "POST" });
      setContainer(data.container);
      setIsViewing(false);
    } catch (err) {
      setErrorMessage(err.message || "Failed to stop container.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleRemove() {
    if (
      !window.confirm(
        "Are you sure you want to remove your container? This will stop it and permanently delete all your saved browser profile data and files.",
      )
    ) {
      return;
    }
    setBusyAction("remove");
    setErrorMessage("");
    try {
      const data = await requestApi("/api/container/remove", { method: "POST" });
      setContainer(data.container);
      setIsViewing(false);
    } catch (err) {
      setErrorMessage(err.message || "Failed to remove container.");
    } finally {
      setBusyAction("");
    }
  }

  // Admin approval / denial
  async function handleApproveSignup(id, reqUsername) {
    try {
      await requestApi(`/api/admin/signups/${id}/approve`, { method: "POST" });
      setSuccessMessage(`Approved ${reqUsername}. They can now log in.`);
      loadPendingSignups();
    } catch (err) {
      setErrorMessage(err.message || "Could not approve request.");
    }
  }

  async function handleDenySignup(id, reqUsername) {
    if (!window.confirm(`Deny and discard registration request for "${reqUsername}"?`)) return;
    try {
      await requestApi(`/api/admin/signups/${id}/deny`, { method: "POST" });
      setSuccessMessage(`Denied registration request for ${reqUsername}.`);
      loadPendingSignups();
    } catch (err) {
      setErrorMessage(err.message || "Could not deny request.");
    }
  }

  // Admin user management
  async function handleCreateUserManual(e) {
    e.preventDefault();
    setIsCreatingUser(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await requestApi("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          username: manualUsername,
          password: manualPassword,
          role: manualRole,
        }),
      });
      setSuccessMessage(`User "${manualUsername}" created successfully!`);
      setManualUsername("");
      setManualPassword("");
      loadAllUsers();
    } catch (err) {
      setErrorMessage(err.message || "Could not create user.");
    } finally {
      setIsCreatingUser(false);
    }
  }

  async function handleToggleRole(targetUser) {
    const nextRole = targetUser.role === "admin" ? "user" : "admin";
    if (
      !window.confirm(
        `Change role of "${targetUser.username}" from ${targetUser.role} to ${nextRole}?`,
      )
    ) {
      return;
    }
    try {
      await requestApi(`/api/admin/users/${targetUser.id || targetUser._id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      });
      setSuccessMessage(`Updated role of ${targetUser.username} to ${nextRole}.`);
      loadAllUsers();
    } catch (err) {
      setErrorMessage(err.message || "Could not update user role.");
    }
  }

  async function handleDeleteUser(targetUser) {
    if (
      !window.confirm(
        `Permanently delete user "${targetUser.username}"? This will stop their container and delete their persistent volumes.`,
      )
    ) {
      return;
    }
    try {
      await requestApi(`/api/admin/users/${targetUser.id || targetUser._id}`, {
        method: "DELETE",
      });
      setSuccessMessage(`User "${targetUser.username}" has been deleted.`);
      loadAllUsers();
    } catch (err) {
      setErrorMessage(err.message || "Could not delete user.");
    }
  }

  // Message board actions
  async function handlePostMessage(e) {
    e.preventDefault();
    setIsPostingMessage(true);
    setErrorMessage("");
    try {
      await requestApi("/api/messages", {
        method: "POST",
        body: JSON.stringify({ title: newMessageTitle, content: newMessageContent }),
      });
      setSuccessMessage("Announcement posted to the message board.");
      setNewMessageTitle("");
      setNewMessageContent("");
      loadMessages();
    } catch (err) {
      setErrorMessage(err.message || "Could not post message.");
    } finally {
      setIsPostingMessage(false);
    }
  }

  async function handleDeleteMessage(id) {
    try {
      await requestApi(`/api/messages/${id}`, { method: "DELETE" });
      loadMessages();
    } catch (err) {
      setErrorMessage(err.message || "Could not delete message.");
    }
  }

  // Account settings
  async function handleChangeUsername(e) {
    e.preventDefault();
    setIsSavingSettings(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const res = await requestApi("/api/user/profile", {
        method: "POST",
        body: JSON.stringify({ username: newUsername }),
      });
      setSuccessMessage("Username updated successfully.");
      onUserUpdate(res.user);
    } catch (err) {
      setErrorMessage(err.message || "Could not update username.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setIsSavingSettings(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await requestApi("/api/user/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      });
      setSuccessMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setErrorMessage(err.message || "Could not update password.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  const status = container?.status ?? "not_created";
  const isRunning = status === "running";
  const isStarting = status === "starting" || busyAction === "start";
  const hasSavedData = Boolean(container?.hasSavedData);

  return (
    <section className="dashboard-main" aria-labelledby="dashboard-heading">
      <div className="dashboard-content">
        {/* Header Introduction */}
        <div className="dashboard-intro">
          <div className="dashboard-heading-copy">
            <div className="card-kicker">
              <span className="kicker-dot" />
              AUTHENTICATED WORKSPACE
            </div>
            <h1 id="dashboard-heading">
              Hello <span className="title-highlight">{user.username}</span>
              <span className="title-period">.</span>
            </h1>
            <p className="dashboard-subtitle">
              Your private Chromium desktop with dedicated persistent volumes.
            </p>
          </div>

          {/* Active Presence Widget */}
          <div className="active-users" aria-live="polite">
            <span className="active-users-icon" aria-hidden="true">
              <span />
            </span>
            <div>
              <strong>{activeStats.count}</strong>
              <span>
                {activeStats.count === 1 ? "user actively browsing" : "users actively browsing"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="dashboard-tabs" aria-label="Dashboard views">
          <button
            className={`tab-button ${activeTab === "workspace" ? "is-active" : ""}`}
            type="button"
            onClick={() => handleSelectTab("workspace")}
          >
            Workspace
          </button>
          <button
            className={`tab-button ${activeTab === "messages" ? "is-active" : ""}`}
            type="button"
            onClick={() => handleSelectTab("messages")}
          >
            Message Board
            {unreadMessagesCount > 0 && (
              <span className="tab-badge">{unreadMessagesCount}</span>
            )}
          </button>
          <button
            className={`tab-button ${activeTab === "settings" ? "is-active" : ""}`}
            type="button"
            onClick={() => handleSelectTab("settings")}
          >
            Account Settings
          </button>

          {isAdmin && (
            <>
              <button
                className={`tab-button ${activeTab === "signups" ? "is-active" : ""}`}
                type="button"
                onClick={() => handleSelectTab("signups")}
              >
                Sign Up Requests
                {pendingRequests.length > 0 && (
                  <span className="tab-badge">{pendingRequests.length}</span>
                )}
              </button>
              <button
                className={`tab-button ${activeTab === "users" ? "is-active" : ""}`}
                type="button"
                onClick={() => handleSelectTab("users")}
              >
                User Management
              </button>
              <button
                className={`tab-button ${activeTab === "docker" ? "is-active" : ""}`}
                type="button"
                onClick={() => handleSelectTab("docker")}
              >
                Docker Stats
              </button>
            </>
          )}
        </nav>

        {/* Global Feedback Banners */}
        {errorMessage && (
          <p className="dashboard-error" role="alert" style={{ marginBottom: "16px" }}>
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <div className="success-banner" role="status">
            {successMessage}
          </div>
        )}

        {/* TAB 1: WORKSPACE */}
        {activeTab === "workspace" && (
          <>
            {isViewing && isRunning ? (
              <section className="browser-session" aria-label="Chromium session">
                <div className="session-toolbar">
                  <div className="session-connection">
                    <span className="connection-indicator" />
                    <span>Chromium Desktop — Online</span>
                  </div>
                  <div className="session-actions">
                    <button
                      className="session-toolbar-button"
                      type="button"
                      onClick={() => setFrameKey((k) => k + 1)}
                      title="Refresh browser view"
                    >
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path
                          d="M16 8a6 6 0 0 0-10.4-2L4 7.5M4 4v3.5h3.5M4 12a6 6 0 0 0 10.4 2L16 12.5M16 16v-3.5h-3.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>Refresh</span>
                    </button>
                    <button
                      className="session-toolbar-button"
                      type="button"
                      onClick={() => setIsViewing(false)}
                      title="Exit full-screen view"
                    >
                      Exit View
                    </button>
                  </div>
                </div>
                <iframe
                  key={frameKey}
                  className="browser-frame"
                  src="/session/"
                  title="Chromium Session"
                  allow="clipboard-read; clipboard-write; fullscreen"
                  allowFullScreen
                />
              </section>
            ) : (
              <section className="workspace-card" aria-labelledby="workspace-title">
                <div className="workspace-card-copy">
                  <div className="workspace-icon" aria-hidden="true">
                    <svg viewBox="0 0 32 32" fill="none">
                      <rect
                        x="4.5"
                        y="6.5"
                        width="23"
                        height="19"
                        rx="2.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M5 11h22M9 8.8h.1m3.3 0h.1m3.3 0h.1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="m12 16 3 2.5-3 2.5m5 0h4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="workspace-status">
                      <span className={isRunning ? "status-dot is-running" : "status-dot"} />
                      {isLoading
                        ? "Checking container..."
                        : isRunning
                          ? "Chromium is online"
                          : isStarting
                            ? "Starting Chromium..."
                            : hasSavedData
                              ? "Stopped (Profile saved)"
                              : "No container created"}
                    </div>
                    <h2 id="workspace-title">
                      {isRunning
                        ? "Your browser is ready"
                        : isStarting
                          ? "Starting your container"
                          : hasSavedData
                            ? "Resume your saved session"
                            : "Create your personal browser"}
                    </h2>
                    <p>
                      {isRunning
                        ? "Your Chromium container is online and responsive. Click Join to open your full-screen browser."
                        : isStarting
                          ? "Starting your LinuxServer Chromium container. You will automatically join once it is responsive."
                          : hasSavedData
                            ? "Your container is stopped, but your profile, bookmarks, and downloads are safely stored in your volume."
                            : "Launch an isolated Chromium container. Your profile and downloads will be preserved across restarts."}
                    </p>
                  </div>
                </div>

                <div className="workspace-controls">
                  {isRunning ? (
                    <>
                      <button
                        className="submit-button workspace-primary-button"
                        type="button"
                        onClick={() => setIsViewing(true)}
                      >
                        <span>Join browser</span>
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path
                            d="M4.5 10h11m0 0-4.5-4.5M15.5 10 11 14.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        className="quiet-button stop-button"
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={handleStop}
                      >
                        {busyAction === "stop" ? "Stopping..." : "Stop container"}
                      </button>
                      <button
                        className="quiet-button"
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={handleRemove}
                      >
                        {busyAction === "remove" ? "Removing..." : "Remove container"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="submit-button workspace-primary-button"
                        type="button"
                        disabled={Boolean(busyAction) || isLoading || isStarting}
                        onClick={handleStart}
                      >
                        <span>
                          {isStarting
                            ? "Starting container..."
                            : hasSavedData
                              ? "Start & join browser"
                              : "Create & start browser"}
                        </span>
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path
                            d="M4.5 10h11m0 0-4.5-4.5M15.5 10 11 14.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      {hasSavedData && (
                        <button
                          className="quiet-button"
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={handleRemove}
                        >
                          {busyAction === "remove" ? "Removing..." : "Remove container & data"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}

            {!isViewing && (
              <section className="panel-card" style={{ marginTop: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <div className="card-kicker">
                      <span className="kicker-dot" />
                      RECENT ANNOUNCEMENTS
                    </div>
                    <h2 style={{ fontSize: "20px", margin: "6px 0 0" }}>Message Board</h2>
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => handleSelectTab("messages")}
                  >
                    View all on Message Board ↗
                  </button>
                </div>
                {messages.length === 0 ? (
                  <p style={{ margin: 0, color: "#8c9189", fontSize: "12px" }}>
                    No announcements posted yet.
                  </p>
                ) : (
                  messages.slice(0, 3).map((msg) => (
                    <div key={msg._id} className="message-item" style={{ marginBottom: "10px" }}>
                      <div className="message-header">
                        <span className="message-title">{msg.title}</span>
                        <span className="message-meta">
                          {msg.authorUsername} · {new Date(msg.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="message-body" style={{ fontSize: "12px" }}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
              </section>
            )}
          </>
        )}

        {/* TAB 2: MESSAGE BOARD */}
        {activeTab === "messages" && (
          <div className="panel-card">
            <h2>Community Message Board</h2>
            <p>Announcements and updates broadcasted by platform administrators.</p>

            {isAdmin && (
              <form
                onSubmit={handlePostMessage}
                style={{
                  marginBottom: "28px",
                  padding: "20px",
                  background: "#fbfaf7",
                  border: "1px solid #e7e6de",
                  borderRadius: "6px",
                }}
              >
                <div className="card-kicker" style={{ marginBottom: "10px" }}>
                  <span className="kicker-dot" />
                  POST ANNOUNCEMENT
                </div>
                <div className="form-row">
                  <label htmlFor="msg-title">Title</label>
                  <input
                    id="msg-title"
                    type="text"
                    placeholder="Announcement title"
                    value={newMessageTitle}
                    onChange={(e) => setNewMessageTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="msg-content">Message Content</label>
                  <textarea
                    id="msg-content"
                    placeholder="Write your announcement to all users..."
                    value={newMessageContent}
                    onChange={(e) => setNewMessageContent(e.target.value)}
                    required
                  />
                </div>
                <button
                  className="btn-small success"
                  type="submit"
                  disabled={isPostingMessage}
                >
                  {isPostingMessage ? "Posting..." : "Broadcast Announcement"}
                </button>
              </form>
            )}

            {messages.length === 0 ? (
              <p style={{ fontStyle: "italic", color: "#9a9e97" }}>
                No messages have been posted to the board yet.
              </p>
            ) : (
              messages.map((msg) => (
                <div key={msg._id} className="message-item">
                  <div className="message-header">
                    <span className="message-title">{msg.title}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span className="message-meta">
                        by <strong>{msg.authorUsername}</strong> ·{" "}
                        {new Date(msg.createdAt).toLocaleDateString()}
                      </span>
                      {isAdmin && (
                        <button
                          className="btn-small danger"
                          type="button"
                          onClick={() => handleDeleteMessage(msg._id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="message-body">{msg.content}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: ACCOUNT SETTINGS */}
        {activeTab === "settings" && (
          <div className="panel-grid">
            <div className="panel-card">
              <h2>Change Username</h2>
              <p>Update your public handle across Carbon Labs.</p>
              <form onSubmit={handleChangeUsername}>
                <div className="form-row">
                  <label htmlFor="settings-username">New Username</label>
                  <input
                    id="settings-username"
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    minLength={3}
                    maxLength={24}
                    pattern="[A-Za-z0-9_-]{3,24}"
                    required
                  />
                </div>
                <button
                  className="btn-small success"
                  type="submit"
                  disabled={isSavingSettings || newUsername === user.username}
                >
                  {isSavingSettings ? "Saving..." : "Update Username"}
                </button>
              </form>
            </div>

            <div className="panel-card">
              <h2>Change Password</h2>
              <p>Ensure your account uses a secure password.</p>
              <form onSubmit={handleChangePassword}>
                <div className="form-row">
                  <label htmlFor="settings-curr-pass">Current Password</label>
                  <input
                    id="settings-curr-pass"
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="settings-new-pass">New Password</label>
                  <input
                    id="settings-new-pass"
                    type="password"
                    placeholder="Enter new password (min. 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="settings-conf-pass">Confirm New Password</label>
                  <input
                    id="settings-conf-pass"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <button
                  className="btn-small success"
                  type="submit"
                  disabled={isSavingSettings}
                >
                  {isSavingSettings ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: SIGN UP REQUESTS (Admin Only) */}
        {isAdmin && activeTab === "signups" && (
          <div className="panel-card">
            <h2>Sign Up Requests</h2>
            <p>
              Review pending registration requests. Approved users can log in immediately.
            </p>

            {pendingRequests.length === 0 ? (
              <p style={{ fontStyle: "italic", color: "#9a9e97" }}>
                No pending registration requests at this time.
              </p>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Requested At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map((req) => (
                      <tr key={req.id || req._id}>
                        <td>
                          <strong>{req.username}</strong>
                        </td>
                        <td>{new Date(req.createdAt).toLocaleString()}</td>
                        <td>
                          <div className="actions-cell">
                            <button
                              className="btn-small success"
                              type="button"
                              onClick={() =>
                                handleApproveSignup(req.id || req._id, req.username)
                              }
                            >
                              Approve
                            </button>
                            <button
                              className="btn-small danger"
                              type="button"
                              onClick={() =>
                                handleDenySignup(req.id || req._id, req.username)
                              }
                            >
                              Deny
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: USER MANAGEMENT (Admin Only) */}
        {isAdmin && activeTab === "users" && (
          <div className="panel-card">
            <h2>User Management</h2>
            <p>Manage existing user accounts, assign admin roles, or manually create users.</p>

            {/* Manual User Creation Form */}
            <form
              onSubmit={handleCreateUserManual}
              style={{
                marginBottom: "28px",
                padding: "20px",
                background: "#fbfaf7",
                border: "1px solid #e7e6de",
                borderRadius: "6px",
              }}
            >
              <div className="card-kicker" style={{ marginBottom: "12px" }}>
                <span className="kicker-dot" />
                CREATE USER MANUALLY
              </div>
              <div className="panel-grid" style={{ marginBottom: "14px" }}>
                <div className="form-row" style={{ margin: 0 }}>
                  <label htmlFor="man-user">Username</label>
                  <input
                    id="man-user"
                    type="text"
                    placeholder="Username"
                    value={manualUsername}
                    onChange={(e) => setManualUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row" style={{ margin: 0 }}>
                  <label htmlFor="man-pass">Password</label>
                  <input
                    id="man-pass"
                    type="password"
                    placeholder="Password (min 8 chars)"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="form-row" style={{ margin: 0 }}>
                  <label htmlFor="man-role">Role</label>
                  <select
                    id="man-role"
                    value={manualRole}
                    onChange={(e) => setManualRole(e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <button
                className="btn-small success"
                type="submit"
                disabled={isCreatingUser}
              >
                {isCreatingUser ? "Creating..." : "Create User"}
              </button>
            </form>

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Last Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u) => {
                    const isSuper = u.role === "superadmin";
                    const isCurrentUser = u.username === user.username;
                    return (
                      <tr key={u.id || u._id}>
                        <td>
                          <strong>{u.username}</strong>
                        </td>
                        <td>
                          <span className={`role-badge ${u.role}`}>{u.role}</span>
                        </td>
                        <td>
                          <span
                            className={`role-badge ${u.status === "approved" ? "admin" : "pending"}`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td>
                          {u.lastActiveAt
                            ? new Date(u.lastActiveAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td>
                          <div className="actions-cell">
                            {!isSuper && !isCurrentUser && (
                              <>
                                <button
                                  className="btn-small"
                                  type="button"
                                  onClick={() => handleToggleRole(u)}
                                >
                                  {u.role === "admin" ? "Demote to User" : "Make Admin"}
                                </button>
                                <button
                                  className="btn-small danger"
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            {isSuper && <span className="info-badge">Protected</span>}
                            {isCurrentUser && !isSuper && (
                              <span className="info-badge">(You)</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: DOCKER STATS (Admin Only) */}
        {isAdmin && activeTab === "docker" && (
          <div className="panel-card">
            <h2>Docker Engine & Volume Statistics</h2>
            <p>Real-time telemetry of Chromium containers and saved user volumes.</p>

            {dockerStats && (
              <>
                <div className="stats-card-row">
                  <div className="stats-stat-box">
                    <div className="stats-stat-label">Running Containers</div>
                    <div className="stats-stat-value" style={{ color: "var(--green)" }}>
                      {dockerStats.summary.runningContainers}
                    </div>
                  </div>
                  <div className="stats-stat-box">
                    <div className="stats-stat-label">Total User Containers</div>
                    <div className="stats-stat-value">{dockerStats.summary.totalContainers}</div>
                  </div>
                  <div className="stats-stat-box">
                    <div className="stats-stat-label">Saved Volumes on Disk</div>
                    <div className="stats-stat-value">{dockerStats.summary.totalVolumes}</div>
                  </div>
                </div>

                <div className="card-kicker" style={{ marginTop: "24px", marginBottom: "8px" }}>
                  <span className="kicker-dot" />
                  ACTIVE CONTAINERS
                </div>
                {dockerStats.containers.length === 0 ? (
                  <p style={{ fontStyle: "italic", color: "#9a9e97" }}>
                    No Chromium containers found.
                  </p>
                ) : (
                  <div className="data-table-wrapper" style={{ marginBottom: "28px" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Container Name</th>
                          <th>Owner</th>
                          <th>Status</th>
                          <th>Host Port</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dockerStats.containers.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <code>{c.name}</code>
                            </td>
                            <td>{c.username}</td>
                            <td>
                              <span
                                className={`role-badge ${c.state === "running" ? "admin" : "user"}`}
                              >
                                {c.status}
                              </span>
                            </td>
                            <td>{c.port ? `127.0.0.1:${c.port}` : "—"}</td>
                            <td>{new Date(c.created).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="card-kicker" style={{ marginBottom: "8px" }}>
                  <span className="kicker-dot" />
                  PERSISTENT VOLUMES (BIND MOUNTS)
                </div>
                {dockerStats.volumes.length === 0 ? (
                  <p style={{ fontStyle: "italic", color: "#9a9e97" }}>
                    No saved volume directories exist yet.
                  </p>
                ) : (
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>User UUID Folder</th>
                          <th>Associated User</th>
                          <th>Created</th>
                          <th>Last Modified</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dockerStats.volumes.map((v) => (
                          <tr key={v.userUuid}>
                            <td>
                              <code>volumes/{v.userUuid}</code>
                            </td>
                            <td>
                              <strong>{v.username}</strong>
                            </td>
                            <td>{new Date(v.createdAt).toLocaleDateString()}</td>
                            <td>{new Date(v.updatedAt).toLocaleTimeString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [message, setMessage] = useState("");

  function navigate(event, nextRoute, replace = false) {
    event?.preventDefault();
    window.history[replace ? "replaceState" : "pushState"]({}, "", nextRoute);
    setRoute(nextRoute);
    setMessage("");
  }

  useEffect(() => {
    const handlePopState = () => {
      setRoute(window.location.pathname);
      setMessage("");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.title =
      route === "/onboarding"
        ? "Carbon Labs — Onboarding"
        : route === "/signup"
          ? "Carbon Labs — Sign up"
          : route === "/dashboard"
            ? "Carbon Labs — Dashboard"
            : "Carbon Labs — Log in";
  }, [route]);

  useEffect(() => {
    let active = true;

    // Check system status & current session
    Promise.all([
      requestApi("/api/system/status").catch(() => ({ onboardingRequired: false })),
      fetch("/api/auth/me").then(async (res) => {
        if (res.status === 401) return null;
        if (!res.ok) return null;
        const data = await res.json().catch(() => ({}));
        return data.user || null;
      }),
    ])
      .then(([systemStatus, authenticatedUser]) => {
        if (!active) return;
        setOnboardingRequired(systemStatus.onboardingRequired);

        if (systemStatus.onboardingRequired) {
          navigate(null, "/onboarding", true);
        } else if (authenticatedUser) {
          setUser(authenticatedUser);
          if (window.location.pathname !== "/dashboard") {
            navigate(null, "/dashboard", true);
          }
        } else {
          if (window.location.pathname === "/dashboard" || window.location.pathname === "/onboarding") {
            navigate(null, "/", true);
          }
        }
      })
      .catch((err) => {
        if (active) setMessage(err.message || "Unable to connect to the server.");
      })
      .finally(() => {
        if (active) setIsCheckingAuth(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    setMessage("");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      navigate(null, "/");
    } catch {
      setUser(null);
      navigate(null, "/");
    }
  }

  const isSignup = route === "/signup";
  const isOnboarding = route === "/onboarding";
  const showDashboard = Boolean(user) && route === "/dashboard";

  return (
    <main
      className={`page-shell ${isSignup || isOnboarding ? "signup-page" : ""} ${showDashboard ? "dashboard-page" : ""}`}
    >
      <header className="topbar">
        <BrandMark />
        {showDashboard ? (
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span className={`role-badge ${user.role}`}>
              {user.role === "superadmin"
                ? "Super Admin"
                : user.role === "admin"
                  ? "Admin"
                  : "User"}
            </span>
            <button className="text-button" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        ) : (
          <span className="topbar-note">
            Thoughtfully built for what comes next <span>↗</span>
          </span>
        )}
      </header>

      {isCheckingAuth ? (
        <div className="auth-loading" role="status">
          Preparing your workspace...
        </div>
      ) : showDashboard ? (
        <Dashboard
          user={user}
          onUserUpdate={(updatedUser) => setUser(updatedUser)}
          onLogout={handleLogout}
        />
      ) : (
        <div className="main-layout">
          <WelcomePanel onboarding={isOnboarding} />
          <div className="vertical-divider" aria-hidden="true">
            <span />
          </div>
          <div className="form-panel">
            <AuthCard
              mode={isOnboarding ? "onboarding" : isSignup ? "signup" : "login"}
              onAuthenticated={(authenticatedUser) => {
                setUser(authenticatedUser);
                navigate(null, "/dashboard");
              }}
              onNavigate={navigate}
              message={message}
              setMessage={setMessage}
            />
            <p className="legal-note">
              By continuing, you agree to our <a href="#terms">Terms</a> and{" "}
              <a href="#privacy">Privacy Policy</a>.
            </p>
          </div>
        </div>
      )}

      <footer className="footer">
        <span>© 2025 Carbon Labs</span>
        <span className="footer-status">
          <span /> GOOD THINGS ARE GROWING
        </span>
      </footer>
    </main>
  );
}
