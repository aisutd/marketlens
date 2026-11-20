
import { useState } from "react";
import { Link } from "react-router-dom";
import { updateProfile } from "firebase/auth";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Mail,
  Save,
  UserRound,
} from "lucide-react";

import { auth } from "../services/firebase";

// ========================================
// FORMATTING
// ========================================

function formatDate(value) {
  if (!value) {
    return "Unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ========================================
// PROFILE PAGE
// ========================================

export default function Profile() {
  const user = auth?.currentUser;

  const [displayName, setDisplayName] = useState(
    user?.displayName ?? ""
  );

  const [savedName, setSavedName] = useState(
    user?.displayName ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ========================================
  // ACCOUNT DETAILS
  // ========================================

  const email = user?.email || "Unavailable";

  const createdAt = formatDate(
    user?.metadata?.creationTime
  );

  const userId = user?.uid || "Unavailable";

  const hasChanges =
    displayName.trim() !== savedName;

  // ========================================
  // UPDATE DISPLAY NAME
  // ========================================

  async function handleSave(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const newName = displayName.trim();

    if (!newName) {
      setError("Please enter a display name.");
      return;
    }

    if (newName.length > 100) {
      setError(
        "Display name must be 100 characters or fewer."
      );
      return;
    }

    const currentUser = auth?.currentUser;

    if (!currentUser || currentUser.uid !== userId) {
      setError(
        "Your session has changed. Please sign in again."
      );
      return;
    }

    if (newName === savedName) {
      setSuccess("Your profile is already up to date.");
      return;
    }

    setSaving(true);

    try {
      await updateProfile(currentUser, {
        displayName: newName,
      });

      if (auth.currentUser?.uid !== userId) {
        return;
      }

      setSavedName(newName);
      setDisplayName(newName);
      setSuccess("Profile updated successfully.");
    } catch (err) {
      console.error("Unable to update profile:", err);

      setError(
        "Unable to update your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // PAGE
  // ========================================

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 lg:pt-16">

        {/* PAGE HEADER */}

        <header className="border-b border-ink pb-10">
          <p className="eyebrow flex items-center gap-3 text-muted-foreground">
            <span className="text-primary">
              Account
            </span>

            <span className="h-px w-8 bg-current" />

            Profile management
          </p>

          <h1 className="mt-6 font-display text-5xl leading-tight sm:text-6xl">
            Your{" "}
            <em className="text-primary">
              profile.
            </em>
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            View your account information and update
            how your name appears in MarketLens.
          </p>
        </header>

        {/* PROFILE CONTENT */}

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">

          {/* EDITABLE PROFILE */}

          <section className="border border-ink bg-card p-6 shadow-offset-sm sm:p-8">
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-ink bg-[#F8EEE0]">
                <UserRound
                  size={27}
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <p className="eyebrow text-muted-foreground">
                  Account profile
                </p>

                <h2 className="mt-2 break-words font-display text-2xl">
                  {savedName || "MarketLens User"}
                </h2>
              </div>
            </div>

            <div className="my-8 border-t border-border" />

            <form
              onSubmit={handleSave}
              className="space-y-6"
            >
              <div>
                <label
                  htmlFor="profile-display-name"
                  className="mb-2 block text-sm font-semibold"
                >
                  Display name
                </label>

                <input
                  id="profile-display-name"
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    setSuccess("");
                    setError("");
                  }}
                  placeholder="Enter your name"
                  className="w-full rounded-md border border-input bg-background px-4 py-3 text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                />

                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  This name is associated with your
                  MarketLens account.
                </p>
              </div>

              <div>
                <label
                  htmlFor="profile-email"
                  className="mb-2 block text-sm font-semibold"
                >
                  Email address
                </label>

                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  readOnly
                  className="w-full cursor-default rounded-md border border-input bg-secondary px-4 py-3 text-muted-foreground"
                />

                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Your email address is managed
                  through Firebase Authentication.
                </p>
              </div>

              {/* ERROR FEEDBACK */}

              {error && (
                <p
                  role="alert"
                  className="border border-destructive bg-background px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              {/* SUCCESS FEEDBACK */}

              {success && (
                <div
                  role="status"
                  className="flex items-center gap-2 border border-border bg-[#E8F3EC] px-4 py-3 text-sm text-[#245B46]"
                >
                  <CheckCircle2
                    size={18}
                    aria-hidden="true"
                  />

                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={saving || !hasChanges}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-ink bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-offset-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save
                  size={17}
                  aria-hidden="true"
                />

                {saving
                  ? "Saving changes..."
                  : "Save Changes"}
              </button>
            </form>
          </section>

          {/* ACCOUNT DETAILS */}

          <section className="flex flex-col border border-ink bg-card p-6 shadow-offset-sm sm:p-8">
            <p className="eyebrow text-primary">
              Account information
            </p>

            <h2 className="mt-4 font-display text-2xl">
              Your account details.
            </h2>

            <div className="mt-8 space-y-6">

              <div className="flex items-start gap-3">
                <Mail
                  size={19}
                  className="mt-0.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />

                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Registered email
                  </p>

                  <p className="mt-2 break-words text-sm font-medium">
                    {email}
                  </p>
                </div>
              </div>

              <div className="border-t border-border" />

              <div className="flex items-start gap-3">
                <CalendarDays
                  size={19}
                  className="mt-0.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />

                <div>
                  <p className="text-xs text-muted-foreground">
                    Member since
                  </p>

                  <p className="mt-2 text-sm font-medium">
                    {createdAt}
                  </p>
                </div>
              </div>

              <div className="border-t border-border" />

              <div className="flex items-start gap-3">
                <UserRound
                  size={19}
                  className="mt-0.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />

                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Account ID
                  </p>

                  <p className="mt-2 break-all font-mono text-xs">
                    {userId}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-10">
              <p className="border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
                MarketLens uses Firebase Authentication
                to manage your account securely.
              </p>
            </div>
          </section>
        </div>

        {/* WORKSPACE NAVIGATION */}

        <section className="mt-12 border-t border-ink pt-8">
          <p className="eyebrow text-primary">
            Your workspace
          </p>

          <h2 className="mt-3 font-display text-2xl">
            Continue exploring.
          </h2>

          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              to="/discover"
              className="inline-flex items-center gap-2 rounded-md border border-ink bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-offset-sm"
            >
              Discover Products
              <ArrowRight size={17} />
            </Link>

            <Link
              to="/saved-products"
              className="inline-flex items-center gap-2 rounded-md border border-ink bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              Saved Products
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
