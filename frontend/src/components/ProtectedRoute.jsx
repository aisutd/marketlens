
import { Fragment } from "react";
import { Navigate, useLocation } from "react-router-dom";

// Loading states fill the screen below the 65px header, so the footer stays
// out of view until the page itself is ready (#84).
export const LOADING_HEIGHT_CLASS = "min-h-[calc(100vh-65px)]";

// ========================================
// PROTECTED ROUTE
// ========================================

export default function ProtectedRoute({ userId, children }) {
  const location = useLocation();

  // ========================================
  // WAIT FOR AUTHENTICATION CHECK
  // ========================================

  if (userId === undefined) {
    return (
      <div
        role="status"
        className={`flex items-center justify-center ${LOADING_HEIGHT_CLASS}`}
      >
        <p className="text-sm text-muted-foreground">
          Checking your session...
        </p>
      </div>
    );
  }

  // ========================================
  // REDIRECT UNAUTHENTICATED USERS
  // ========================================

  if (!userId) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // ========================================
  // ALLOW AUTHENTICATED USERS
  // ========================================

  return <Fragment key={userId}>{children}</Fragment>;
}
