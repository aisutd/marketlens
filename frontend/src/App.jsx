
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firebaseSetupMessage } from "./services/firebase";

import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

// ========================================
// SHARED COMPONENTS
// ========================================

import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";

// ========================================
// PAGES
// ========================================

import LandingPage from "./pages/LandingPage";
import Discover from "./pages/Discover";
import Overview from "./pages/Overview";
import SalesForecastOverview from "./pages/SalesForecastOverview";
import LaunchForecastOverview from "./pages/LaunchForecastOverview";
import ScoreDetails from "./pages/ScoreDetails";
import LaunchFeasibility from "./pages/LaunchFeasibility";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";

// ========================================
// LOCAL STORAGE
// ========================================

const STORAGE_KEY =
  "marketlens:current-analysis:v1";

const STORAGE_VERSION = 1;

const EMPTY_ANALYSIS = {
  product: null,
  prediction: null,
  scoredProduct: null,
  forecast: null,
};

// ========================================
// RESTORE PREVIOUS ANALYSIS
// ========================================

function loadStoredAnalysis(userId) {
  try {
    if (!userId) {
      localStorage.removeItem(STORAGE_KEY);
      return EMPTY_ANALYSIS;
    }

    const savedData = localStorage.getItem(
      STORAGE_KEY
    );

    if (!savedData) {
      return { ...EMPTY_ANALYSIS };
    }

    const stored = JSON.parse(savedData);

    if (stored?.userId !== userId) {
      localStorage.removeItem(STORAGE_KEY);
      return EMPTY_ANALYSIS;
    }

    if (
      stored.version !== STORAGE_VERSION ||
      !stored.analysis ||
      typeof stored.analysis !== "object" ||
      Array.isArray(stored.analysis)
    ) {
      return { ...EMPTY_ANALYSIS };
    }

    const saved = stored.analysis;

    const isObjectOrNull = (value) =>
      value == null ||
      (typeof value === "object" &&
        !Array.isArray(value));

    if (
      !isObjectOrNull(saved.product) ||
      !isObjectOrNull(saved.prediction) ||
      !isObjectOrNull(saved.scoredProduct) ||
      !isObjectOrNull(saved.forecast)
    ) {
      return { ...EMPTY_ANALYSIS };
    }

    if (
      saved.forecast &&
      saved.forecast.type !== "launch" &&
      saved.forecast.type !== "existing"
    ) {
      return { ...EMPTY_ANALYSIS };
    }

    return {
      product: saved.product ?? null,
      prediction: saved.prediction ?? null,
      scoredProduct: saved.scoredProduct ?? null,
      forecast: saved.forecast ?? null,
    };
  } catch (error) {
    console.warn(
      "Unable to restore MarketLens analysis:",
      error
    );

    return { ...EMPTY_ANALYSIS };
  }
}

// ========================================
// SAVE CURRENT ANALYSIS
// ========================================

function saveStoredAnalysis(userId, analysis) {
  try {
    const hasResult = Boolean(
      analysis.product ||
        analysis.prediction ||
        analysis.scoredProduct ||
        analysis.forecast
    );

    if (!hasResult) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const payload = {
      version: STORAGE_VERSION,
      userId,
      analysis,
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.warn(
      "Unable to save MarketLens analysis:",
      error
    );
  }
}

// ========================================
// CONDITIONAL APPLICATION HEADER
// ========================================

function AppHeader({ userId }) {
  const location = useLocation();

  const publicPages = ["/", "/signup", "/login"];

  if (publicPages.includes(location.pathname)) {
    return null;
  }

  return (
    <ProtectedRoute userId={userId}>
      <Header />
    </ProtectedRoute>
  );
}

// ========================================
// COPYRIGHT FOOTER
// ========================================

function Footer() {
  const location = useLocation();

  // LandingPage renders its own footer.

  if (location.pathname === "/") {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-border bg-white/50 px-6 py-6">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-center gap-2 text-center">

        <p className="text-sm font-medium text-muted-foreground">
          © {new Date().getFullYear()} MarketLens.
          All rights reserved.
        </p>

        <p className="text-xs text-muted-foreground">
          AI-Powered Product Intelligence
        </p>

      </div>
    </footer>
  );
}

function FirebaseSetupNotice() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div role="alert" className="rounded-lg border border-border bg-card p-6">
        <h1 className="mb-3 text-xl font-semibold">Firebase setup required</h1>
        <p>{firebaseSetupMessage}</p>
      </div>
      <Link to="/#try" className="mt-4 inline-block font-medium underline">
        Try the demo without an account
      </Link>
    </main>
  );
}

// ========================================
// MAIN APPLICATION
// ========================================

export default function App() {
  const activeSession = useRef(null);
  const [{ session, analysis }, setAnalysisState] = useState({
    session: null,
    analysis: EMPTY_ANALYSIS,
  });
  const userId = auth ? session?.userId : null;

  useEffect(() => {
    if (!auth) return;

    function updateSession(user) {
      const nextSession = { userId: user?.uid ?? null };
      activeSession.current = nextSession;
      setAnalysisState({
        session: nextSession,
        analysis: loadStoredAnalysis(nextSession.userId),
      });
    }

    return onAuthStateChanged(auth, updateSession, (error) => {
      console.error("Authentication check failed:", error);
      updateSession(null);
    });
  }, []);

  const {
    prediction,
    scoredProduct,
    forecast,
  } = analysis;

  // ========================================
  // PERSIST ANALYSIS STATE
  // ========================================

  useEffect(() => {
    if (
      userId &&
      session === activeSession.current &&
      auth.currentUser?.uid === userId
    ) {
      saveStoredAnalysis(userId, analysis);
    }
  }, [analysis, session, userId]);

  // ========================================
  // UPDATE ANALYSIS STATE
  // ========================================

  function updateAnalysisField(field, value) {
    // A request started in a previous session may finish after sign-out.
    if (
      !userId ||
      session !== activeSession.current ||
      auth.currentUser?.uid !== userId
    ) {
      return;
    }

    setAnalysisState((previous) => {
      if (previous.session !== session) return previous;

      return {
        session,
        analysis: {
          ...previous.analysis,
          [field]:
            typeof value === "function"
              ? value(previous.analysis[field])
              : value,
        },
      };
    });
  }

  const setProduct = (value) =>
    updateAnalysisField("product", value);

  const setPrediction = (value) =>
    updateAnalysisField("prediction", value);

  const setScoredProduct = (value) =>
    updateAnalysisField("scoredProduct", value);

  const setForecast = (value) =>
    updateAnalysisField("forecast", value);

  // ========================================
  // OVERVIEW ROUTING
  // ========================================

  const overviewDestination =
    forecast?.type === "existing" ||
    forecast?.type === "launch"
      ? "/sales-forecast-overview"
      : "/product-overview";

  // ========================================
  // APPLICATION LAYOUT
  // ========================================

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#F8FAFC] to-[#DCE3EA]">

        {/* CONDITIONAL NAVIGATION */}
        <AppHeader userId={userId} />

        {/* PAGE CONTENT */}
        <div className="w-full flex-1">
          <Routes>

            {/* ========================================
                LANDING PAGE
            ======================================== */}

            <Route
              path="/"
              element={<LandingPage />}
            />

            {/* ========================================
                USER SIGN UP
            ======================================== */}

            <Route
              path="/signup"
              element={auth ? <SignUp /> : <FirebaseSetupNotice />}
            />

            {/* ========================================
                USER LOGIN
            ======================================== */}

            <Route
              path="/login"
              element={auth ? <Login /> : <FirebaseSetupNotice />}
            />

            {/* ========================================
                DISCOVER PRODUCTS
            ======================================== */}

            <Route
              path="/discover"
              element={
                <ProtectedRoute userId={userId}>
                  <Discover
                    setProduct={setProduct}
                    setPrediction={setPrediction}
                    setScoredProduct={setScoredProduct}
                    setForecast={setForecast}
                  />
                </ProtectedRoute>
              }
            />

            {/* ========================================
                PRODUCT OPPORTUNITY ANALYSIS
            ======================================== */}

            <Route
              path="/product-overview"
              element={
                <ProtectedRoute userId={userId}>
                  <Overview
                    product={scoredProduct}
                    prediction={prediction}
                    forecast={forecast}
                  />
                </ProtectedRoute>
              }
            />

            {/* ========================================
                SALES FORECASTING
                NEW PRODUCT + EXISTING PRODUCT
            ======================================== */}

            <Route
              path="/sales-forecast-overview"
              element={
                <ProtectedRoute userId={userId}>
                  {forecast?.type === "launch" ? (
                    <LaunchForecastOverview
                      forecast={forecast}
                    />
                  ) : (
                    <SalesForecastOverview
                      forecast={forecast}
                    />
                  )}
                </ProtectedRoute>
              }
            />

            {/* ========================================
                LEGACY OVERVIEW REDIRECT
            ======================================== */}

            <Route
              path="/overview"
              element={
                <ProtectedRoute userId={userId}>
                  <Navigate
                    to={overviewDestination}
                    replace
                  />
                </ProtectedRoute>
              }
            />

            {/* ========================================
                SCORE EXPLANATIONS
            ======================================== */}

            <Route
              path="/score-details"
              element={
                <ProtectedRoute userId={userId}>
                  <ScoreDetails
                    product={scoredProduct}
                    prediction={prediction}
                  />
                </ProtectedRoute>
              }
            />

            {/* ========================================
                WHAT-IF PRICE SIMULATOR
            ======================================== */}

            <Route
              path="/launch-feasibility"
              element={
                <ProtectedRoute userId={userId}>
                  <LaunchFeasibility
                    key={
                      scoredProduct
                        ? JSON.stringify(scoredProduct)
                        : "no-product"
                    }
                    product={scoredProduct}
                    prediction={prediction}
                  />
                </ProtectedRoute>
              }
            />

            {/* ========================================
                FALLBACK ROUTE
            ======================================== */}

            <Route
              path="*"
              element={
                <Navigate
                  to="/discover"
                  replace
                />
              }
            />

          </Routes>
        </div>

        {/* GLOBAL COPYRIGHT FOOTER */}
        <Footer />

      </div>
    </BrowserRouter>
  );
}
