// Shared request helper for the MarketLens API clients.
//
// Every failure becomes an ApiError whose message is written for
// the person using the page.

export const REQUEST_TIMEOUT_MS = 60000;

// ========================================
// CUSTOM API ERROR
// ========================================

export class ApiError extends Error {
  constructor(
    message,
    {
      kind,
      status = null,
      retryable,
      retryAfter = null,
    }
  ) {
    super(message);

    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
  }
}

// ========================================
// ERROR UTILITIES
// ========================================

export function isRetryable(error) {
  return error instanceof ApiError
    ? error.retryable
    : true;
}

export function errorMessage(error, fallback) {
  return (error && error.message) || fallback;
}

// ========================================
// RATE LIMIT UTILITIES
// ========================================

function getRetryAfter(response, body) {
  const header = response.headers.get("Retry-After");

  if (header !== null) {
    const seconds = Number(header);

    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds);
    }

    const date = Date.parse(header);

    if (Number.isFinite(date)) {
      return Math.max(
        1,
        Math.ceil((date - Date.now()) / 1000)
      );
    }
  }

  const seconds = Number(
    body?.error?.details?.[0]?.retry_after
  );

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds);
  }

  return null;
}

function formatRetryAfter(seconds) {
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }

  if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);

    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.ceil(seconds / 3600);

  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

// ========================================
// SHARED API REQUEST
// ========================================

export async function requestJson(
  url,
  {
    service,
    readError,
    timeoutMs = REQUEST_TIMEOUT_MS,
    ...options
  }
) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

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
        {
          kind: "timeout",
          retryable: true,
        }
      );
    }

    throw new ApiError(
      `Couldn't reach the ${service}. Check your connection and try again.`,
      {
        kind: "network",
        retryable: true,
      }
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
        {
          kind: "timeout",
          retryable: true,
        }
      );
    }
  } finally {
    clearTimeout(timer);
  }

  const { status } = response;

  // ========================================
  // SUCCESSFUL RESPONSE
  // ========================================

  if (response.ok) {
    if (!readable) {
      throw new ApiError(
        `The ${service} sent a response MarketLens couldn't read. ` +
          "Try again in a moment.",
        {
          kind: "invalid-response",
          status,
          retryable: true,
        }
      );
    }

    return body;
  }

  // ========================================
  // USER RATE LIMIT EXCEEDED
  // ========================================

  if (
    status === 429 &&
    body?.error?.code === "rate_limit_exceeded"
  ) {
    const retryAfter = getRetryAfter(response, body);

    const message =
      retryAfter !== null
        ? `You have reached your request limit. Please try again in ${formatRetryAfter(retryAfter)}.`
        : "You have reached your request limit. Please try again later.";

    throw new ApiError(message, {
      kind: "rate-limit",
      status,
      retryable: false,
      retryAfter,
    });
  }

  // ========================================
  // TEMPORARILY BUSY SERVICE
  // ========================================

  if (status === 408 || status === 429) {
    throw new ApiError(
      `The ${service} is busy right now. Wait a moment and try again.`,
      {
        kind: "busy",
        status,
        retryable: true,
      }
    );
  }

  // ========================================
  // SERVER ERRORS
  // ========================================

  if (status >= 500) {
    throw new ApiError(
      `The ${service} ran into a problem (error ${status}). ` +
        "Try again in a moment.",
      {
        kind: "server",
        status,
        retryable: true,
      }
    );
  }

  // ========================================
  // OTHER REQUEST ERRORS
  // ========================================

  const detail =
    readable && body ? readError(body) : "";

  throw new ApiError(
    detail ||
      `The ${service} couldn't process this request (error ${status}). ` +
        "Check the details and try again.",
    {
      kind: "rejected",
      status,
      retryable: false,
    }
  );
}