import { useLayoutEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";

import { focusSlotAfter } from "../lib/focus";

import { isRetryable } from "../services/apiClient";

// An API failure, said plainly, with a way to try again when trying
// again can help. `error` is the thrown error (an ApiError from the
// services, or any Error); the button shows only when `onRetry` is
// given and the error is retryable, so a rejected input never offers a
// retry that would fail the same way.
export default function ApiErrorNotice(props) {
  if (!props.error) return null;
  return <Notice {...props} />;
}

function Notice({
  title,
  error,
  onRetry,
  retrying = false,
  retryLabel = "Try again",
  className = "",
}) {
  const ref = useRef(null);

  // When Try again works the notice goes away, and focus would go with it
  // to the page. Move it to whatever now sits where the notice was (#86).
  useLayoutEffect(() => {
    const notice = ref.current;
    return () => {
      if (notice?.contains(document.activeElement)) {
        focusSlotAfter(notice.previousElementSibling, notice.parentElement);
      }
    };
  }, []);

  const message =
    typeof error === "string"
      ? error
      : error.message || "Something went wrong.";

  const canRetry =
    typeof onRetry === "function" &&
    (typeof error === "string" || isRetryable(error));

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      data-route-target=""
      className={
        "border border-destructive bg-card p-5 text-sm " +
        "text-foreground shadow-offset-sm " +
        className
      }
    >
      <p className="font-semibold">{title}</p>

      <p className="mt-1 text-muted-foreground">{message}</p>

      {canRetry && (
        // aria-disabled, not disabled, while retrying, so the button keeps
        // focus (#86); presses meanwhile are ignored.
        <button
          type="button"
          onClick={() => {
            if (!retrying) onRetry();
          }}
          aria-disabled={retrying || undefined}
          className={
            "mt-4 inline-flex min-h-10 items-center gap-2 " +
            "rounded-md border border-ink bg-background px-4 py-2 " +
            "font-semibold text-foreground transition-colors " +
            "hover:bg-secondary " +
            "focus-visible:outline-2 focus-visible:outline-offset-4 " +
            "focus-visible:outline-primary " +
            "aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          }
        >
          <RotateCcw size={16} aria-hidden="true" />
          {retrying ? "Trying again..." : retryLabel}
        </button>
      )}
    </div>
  );
}
