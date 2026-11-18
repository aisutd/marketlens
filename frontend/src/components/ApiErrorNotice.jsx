import { RotateCcw } from "lucide-react";

import { isRetryable } from "../services/apiClient";

// An API failure, said plainly, with a way to try again when trying
// again can help. `error` is the thrown error (an ApiError from the
// services, or any Error); the button shows only when `onRetry` is
// given and the error is retryable, so a rejected input never offers a
// retry that would fail the same way.
export default function ApiErrorNotice({
  title,
  error,
  onRetry,
  retrying = false,
  retryLabel = "Try again",
  className = "",
}) {
  if (!error) return null;

  const message =
    typeof error === "string"
      ? error
      : error.message || "Something went wrong.";

  const canRetry =
    typeof onRetry === "function" &&
    (typeof error === "string" || isRetryable(error));

  return (
    <div
      role="alert"
      className={
        "border border-destructive bg-card p-5 text-sm " +
        "text-foreground shadow-offset-sm " +
        className
      }
    >
      <p className="font-semibold">{title}</p>

      <p className="mt-1 text-muted-foreground">{message}</p>

      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className={
            "mt-4 inline-flex min-h-10 items-center gap-2 " +
            "rounded-md border border-ink bg-background px-4 py-2 " +
            "font-semibold text-foreground transition-colors " +
            "hover:bg-secondary " +
            "focus-visible:outline-2 focus-visible:outline-offset-4 " +
            "focus-visible:outline-primary " +
            "disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          <RotateCcw size={16} aria-hidden="true" />
          {retrying ? "Trying again..." : retryLabel}
        </button>
      )}
    </div>
  );
}
