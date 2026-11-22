
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";

import {
  auth,
  firebaseSetupMessage,
  isFirebaseSetupError,
} from "../services/firebase";
import { returnPathFrom } from "../services/returnPath";

// ========================================
// LOGIN PAGE
// ========================================

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // ========================================
  // FORM STATE
  // ========================================

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ========================================
  // HANDLE LOGIN
  // ========================================

  async function handleLogin(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // Return to the page that sent the user here, or Discover.
      navigate(returnPathFrom(location.state), { replace: true });

    } catch (error) {
      console.error("Login failed:", error.code);

      if (isFirebaseSetupError(error.code)) {
        setError(firebaseSetupMessage);
      } else if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        setError("Incorrect email or password.");
      } else if (error.code === "auth/too-many-requests") {
        setError(
          "Too many attempts. Please try again later."
        );
      } else if (error.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError(
          "Unable to sign in. Please try again."
        );
      }

    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // LOGIN FORM
  // ========================================

  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md border border-ink bg-card p-8 shadow-offset sm:p-10">

        {/* PAGE HEADING */}
        <div className="mb-8 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            MARKETLENS ACCOUNT
          </p>

          <h1 className="font-display text-4xl text-foreground">
            Welcome back.
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            Sign in to continue to MarketLens.
          </p>
        </div>

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin} className="space-y-5">

          {/* EMAIL */}
          <div>
            <label
              htmlFor="login-email"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Email address
            </label>

            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              className="w-full border border-input bg-background px-4 py-3 text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* PASSWORD */}
          <div>
            <label
              htmlFor="login-password"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Password
            </label>

            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              className="w-full border border-input bg-background px-4 py-3 text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <p
              role="alert"
              className="border border-destructive bg-background px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md border border-ink bg-primary px-5 py-3 font-medium text-primary-foreground shadow-offset-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

        </form>

        {/* SIGNUP LINK */}
        <p className="mt-7 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            to="/signup"
            state={location.state}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>

        {/* RETURN TO LANDING PAGE */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Back to home
          </Link>
        </div>

      </div>
    </main>
  );
}
