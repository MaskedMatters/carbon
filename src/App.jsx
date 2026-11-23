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

function WelcomePanel() {
  return (
    <section className="welcome-panel" aria-labelledby="welcome-heading">
      <div className="welcome-copy">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          A BETTER WAY FORWARD
        </div>
        <h1 id="welcome-heading">
          Welcome to
          <br />
          <span className="title-highlight">Carbon Labs</span>
          <span className="title-period">.</span>
        </h1>
        <p className="welcome-description">
          Carbon Labs is an interdisciplinary research community advancing
          sustainable materials through rigorous inquiry and collaboration. We
          bring researchers together to turn evidence into lasting impact.
        </p>
        <div className="welcome-footnote">
          Research <span>·</span> Collaboration <span>·</span> Discovery
        </div>
      </div>
    </section>
  );
}

function AuthCard({ mode, onAuthenticated, onNavigate, message, setMessage }) {
  const isSignup = mode === "signup";
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (isSignup && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${isSignup ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, confirmPassword }),
      });
      const text = await response.text();
      let result = {};
      try {
        result = text ? JSON.parse(text) : {};
      } catch {
        // Response was not JSON
      }

      if (!response.ok) {
        throw new Error(result.error || "Unable to authenticate. Please check the backend server.");
      }

      onAuthenticated(result.user);
    } catch (error) {
      setMessage(error.message || "Unable to connect. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="login-card" aria-labelledby="login-heading">
      <div className="card-kicker">
        <span className="kicker-dot" />
        {isSignup ? "START YOUR JOURNEY" : "YOUR WORKSPACE AWAITS"}
      </div>
      <h2 id="login-heading">
        {isSignup ? "Sign up" : "Log in"}
        <span>.</span>
      </h2>
      <p className="card-description">
        {isSignup ? "Create your Carbon Labs account." : "Good to have you back."}
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
          {isSignup && <span>At least 8 characters</span>}
        </div>
        <input
          id="password"
          name="password"
          type="password"
          placeholder={isSignup ? "Create a password" : "Enter your password"}
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={8}
          required
        />

        {isSignup && (
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
              : isSignup
                ? "Create your account"
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
    </section>
  );
}

function Dashboard({ user }) {
  const [container, setContainer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [isViewing, setIsViewing] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const loadContainer = async () => {
    try {
      const data = await requestApi("/api/container");
      setContainer(data.container);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message || "Unable to check container status.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContainer();
    const interval = setInterval(loadContainer, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleStart(autoJoin = true) {
    setBusyAction("start");
    setErrorMessage("");
    try {
      const data = await requestApi("/api/container/start", { method: "POST" });
      setContainer(data.container);
      if (autoJoin && data.container?.ready) {
        setIsViewing(true);
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to start container.");
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
    } catch (error) {
      setErrorMessage(error.message || "Failed to stop container.");
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
    } catch (error) {
      setErrorMessage(error.message || "Failed to remove container.");
    } finally {
      setBusyAction("");
    }
  }

  const status = container?.status ?? "not_created";
  const isRunning = status === "running";
  const isStarting = status === "starting" || busyAction === "start";
  const isStopped = status === "stopped";
  const hasSavedData = Boolean(container?.hasSavedData);

  return (
    <section className="dashboard-main" aria-labelledby="dashboard-heading">
      <div className="dashboard-content">
        <div className="dashboard-intro">
          <div className="dashboard-heading-copy">
            <div className="card-kicker">
              <span className="kicker-dot" />
              YOUR PRIVATE WORKSPACE
            </div>
            <h1 id="dashboard-heading">
              Hello <span className="title-highlight">{user.username}</span>
              <span className="title-period">.</span>
            </h1>
            <p className="dashboard-subtitle">
              Your own private Chromium desktop, ready whenever you are.
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="dashboard-error" role="alert">
            {errorMessage}
          </p>
        )}

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
                      ? "Starting your LinuxServer Chromium container. You will be automatically joined once it is responsive."
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
                    onClick={() => handleStart(true)}
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

        <section className="community-card" aria-label="Community">
          <div className="community-mark" aria-hidden="true">✳</div>
          <div>
            <h2>Dedicated, persistent browser containers</h2>
            <p>Every account gets an isolated container with private volume storage organized by your user UUID.</p>
          </div>
          <span className="coming-soon">CARBON LABS</span>
        </section>
      </div>
    </section>
  );
}

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
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
      route === "/signup"
        ? "Carbon Labs — Sign up"
        : route === "/dashboard"
          ? "Carbon Labs — Dashboard"
          : "Carbon Labs — Log in";
  }, [route]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then(async (response) => {
        if (response.status === 401) {
          return null;
        }
        if (!response.ok) {
          throw new Error("Unable to reach backend server. Please verify MongoDB and the server are running.");
        }
        const text = await response.text();
        const result = text ? JSON.parse(text) : {};
        return result.user;
      })
      .then((authenticatedUser) => {
        if (!active) return;
        setUser(authenticatedUser);
        if (authenticatedUser && window.location.pathname !== "/dashboard") {
          navigate(null, "/dashboard", true);
        } else if (!authenticatedUser && window.location.pathname === "/dashboard") {
          navigate(null, "/", true);
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(error.message || "Unable to connect to the server.");
        }
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
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Unable to log out. Please try again.");
      }
      setUser(null);
      navigate(null, "/");
    } catch (error) {
      setMessage(error.message || "Unable to connect to the server.");
    }
  }

  const isSignup = route === "/signup";
  const showDashboard = Boolean(user) && route === "/dashboard";

  return (
    <main
      className={`page-shell ${isSignup ? "signup-page" : ""} ${showDashboard ? "dashboard-page" : ""}`}
    >
      <header className="topbar">
        <BrandMark />
        {showDashboard ? (
          <button className="text-button" type="button" onClick={handleLogout}>
            Log out
          </button>
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
        <Dashboard user={user} />
      ) : (
        <div className="main-layout">
          <WelcomePanel />
          <div className="vertical-divider" aria-hidden="true">
            <span />
          </div>
          <div className="form-panel">
            <AuthCard
              mode={isSignup ? "signup" : "login"}
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
