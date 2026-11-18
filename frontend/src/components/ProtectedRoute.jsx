
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../services/firebase";

// ========================================
// PROTECTED ROUTE
// ========================================

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const location = useLocation();

  // ========================================
  // CHECK FIREBASE AUTHENTICATION
  // ========================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (error) => {
        console.error("Authentication check failed:", error);
        setUser(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ========================================
  // WAIT FOR AUTHENTICATION CHECK
  // ========================================

  if (loading) {
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

  if (!user) {
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

  return children;
}
