
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";

import {
  auth,
  firebaseSetupMessage,
  isFirebaseSetupError,
} from "../services/firebase";

// ========================================
// LOGIN PAGE
// ========================================

export default function Login() {
  const navigate = useNavigate();

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

      // Redirect after successful login.
      navigate("/discover", { replace: true });

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
    <div className="flex min-h-[75vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md border border-[#2B211B] bg-[#FAF6EE] p-8 shadow-[5px_5px_0px_#2B211B]">

        {/* PAGE HEADING */}
        <div className="mb-8 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#C52D08]">
            MARKETLENS ACCOUNT
          </p>

          <h1 className="font-serif text-4xl text-[#201711]">
            Welcome back.
          </h1>

          <p className="mt-3 text-sm text-[#756B63]">
            Sign in to continue to MarketLens.
          </p>
        </div>

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin} className="space-y-5">

          {/* EMAIL */}
          <div>
            <label
              htmlFor="login-email"
              className="mb-2 block text-sm font-medium text-[#201711]"
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
              className="w-full border border-[#BDB3A7] bg-white px-4 py-3 text-[#201711] outline-none focus:border-[#C52D08]"
            />
          </div>

          {/* PASSWORD */}
          <div>
            <label
              htmlFor="login-password"
              className="mb-2 block text-sm font-medium text-[#201711]"
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
              className="w-full border border-[#BDB3A7] bg-white px-4 py-3 text-[#201711] outline-none focus:border-[#C52D08]"
            />
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <p
              role="alert"
              className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C52D08] px-5 py-3 font-medium text-white transition-colors hover:bg-[#A92507] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

        </form>

        {/* SIGNUP LINK */}
        <p className="mt-7 text-center text-sm text-[#756B63]">
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="font-semibold text-[#C52D08] hover:underline"
          >
            Create an account
          </Link>
        </p>

      </div>
    </div>
  );
}
