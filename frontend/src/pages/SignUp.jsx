
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";

import {
  auth,
  firebaseSetupMessage,
  isFirebaseSetupError,
} from "../services/firebase";

export default function SignUp() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ========================================
  // HANDLE SIGN UP
  // ========================================

  async function handleSignUp(event) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      navigate("/discover", { replace: true });
    } catch (err) {
      if (isFirebaseSetupError(err.code)) {
        setError(firebaseSetupMessage);
      } else if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/weak-password") {
        setError("Please choose a stronger password.");
      } else {
        setError("Unable to create your account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // SIGN UP FORM
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
            Create your account.
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            Get started with MarketLens.
          </p>
        </div>

        {/* SIGN UP FORM */}
        <form onSubmit={handleSignUp} className="space-y-5">

          {/* EMAIL */}
          <div>
            <label
              htmlFor="signup-email"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Email address
            </label>

            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full border border-input bg-background px-4 py-3 text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* PASSWORD */}
          <div>
            <label
              htmlFor="signup-password"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Password
            </label>

            <input
              id="signup-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              className="w-full border border-input bg-background px-4 py-3 text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* CONFIRM PASSWORD */}
          <div>
            <label
              htmlFor="signup-confirm-password"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Confirm password
            </label>

            <input
              id="signup-confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Confirm your password"
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

          {/* CREATE ACCOUNT BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md border border-ink bg-primary px-5 py-3 font-medium text-primary-foreground shadow-offset-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        {/* LOGIN LINK */}
        <p className="mt-7 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Log In
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
