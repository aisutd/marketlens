
import { Fragment } from "react";
import { Navigate, useLocation } from "react-router-dom";

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
        className="flex min-h-[60vh] items-center justify-center"
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
