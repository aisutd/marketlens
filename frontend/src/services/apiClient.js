// Shared request helper for the MarketLens API clients.
//
// Every failure becomes an ApiError whose message is written for the
// person using the page (not "Failed to fetch" or "Request failed (502)")
// and whose `retryable` flag tells the page whether a Retry button can
// help: a dropped connection, a timeout or a server error might pass on
// a second try; a rejected input will not.

// A Cloud Run cold start measured 33 s on both services (2026-11-18),
// so the limit leaves room for one; a warm call answers in under 1 s.
export const REQUEST_TIMEOUT_MS = 60000;

export class ApiError extends Error {
  constructor(message, { kind, status = null, retryable }) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.retryable = retryable;
  }
}

export function isRetryable(error) {
  return error instanceof ApiError ? error.retryable : true;
}

export function errorMessage(error, fallback) {
  return (error && error.message) || fallback;
}

// `service` names what was being reached ("scoring service",
// "forecasting service"); `readError` pulls the server's own message out
// of an error body, which is shown for 4xx responses only.
export async function requestJson(url, {
  service,
  readError,
  timeoutMs = REQUEST_TIMEOUT_MS,
  ...options
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;

  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);

    if (error?.name === "AbortError") {
      throw new ApiError(
        `The ${service} took too long to respond. It may be starting ` +
          "up; try again in a moment.",
        { kind: "timeout", retryable: true }
      );
    }

    throw new ApiError(
      `Couldn't reach the ${service}. Check your connection and try again.`,
      { kind: "network", retryable: true }
    );
  }

  let body = null;
  let readable = true;

  try {
    body = await response.json();
  } catch (error) {
    readable = false;

    if (error?.name === "AbortError") {
      throw new ApiError(
        `The ${service} took too long to respond. Try again in a moment.`,
        { kind: "timeout", retryable: true }
      );
    }
  } finally {
    clearTimeout(timer);
  }

  const { status } = response;

  if (response.ok) {
    if (!readable) {
      throw new ApiError(
        `The ${service} sent a response MarketLens couldn't read. ` +
          "Try again in a moment.",
        { kind: "invalid-response", status, retryable: true }
      );
    }

    return body;
  }

  if (status === 408 || status === 429) {
    throw new ApiError(
      `The ${service} is busy right now. Wait a moment and try again.`,
      { kind: "busy", status, retryable: true }
    );
  }

  if (status >= 500) {
    throw new ApiError(
      `The ${service} ran into a problem (error ${status}). ` +
        "Try again in a moment.",
      { kind: "server", status, retryable: true }
    );
  }

  const detail = readable && body ? readError(body) : "";

  throw new ApiError(
    detail ||
      `The ${service} couldn't process this request (error ${status}). ` +
        "Check the details and try again.",
    { kind: "rejected", status, retryable: false }
  );
}
