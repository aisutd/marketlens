import { Link, useLocation } from "react-router-dom";

// ========================================
// NOT FOUND (#77)
// ========================================

// Shown for any address the app has no page for, instead of sending the
// visitor somewhere else without a word. The address stays in the bar
// and in history, so it can be checked or corrected.

const primaryLink =
  "inline-flex items-center justify-center gap-2 rounded-md border " +
  "border-ink bg-primary px-6 py-3 text-sm font-semibold " +
  "text-primary-foreground shadow-offset-sm transition-all " +
  "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-primary";

const secondaryLink =
  "text-sm font-medium text-foreground underline underline-offset-4 " +
  "hover:text-primary focus-visible:rounded-sm focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function NotFound({ userId }) {
  const { pathname } = useLocation();
  const signedIn = Boolean(userId);

  return (
    <main className="text-foreground">
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-16 sm:px-8 lg:pt-24">
        <p className="eyebrow text-primary">
          Error 404
        </p>

        <h1 className="mt-6 font-display text-5xl sm:text-6xl">
          Page not found.
        </h1>

        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          There is no page at{" "}
          <code className="break-all rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-base text-foreground">
            {pathname}
          </code>. The link may be out of date, or the address may have a typo.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-6">
          {signedIn ? (
            <>
              <Link to="/discover" className={primaryLink}>
                Go to Discover
              </Link>
              <Link to="/" className={secondaryLink}>
                Back to home
              </Link>
            </>
          ) : (
            <>
              <Link to="/" className={primaryLink}>
                Back to home
              </Link>
              <Link to="/login" className={secondaryLink}>
                Log in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
