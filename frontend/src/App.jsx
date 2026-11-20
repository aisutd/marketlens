
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { onAuthStateChanged } from "firebase/auth";

import {
  auth,
  firebaseSetupMessage,
} from "./services/firebase";

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
import SaveProductButton from "./components/SaveProductButton";

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
import SavedProducts from "./pages/SavedProducts";
import Profile from "./pages/Profile";

// ========================================
// LOCAL STORAGE
// ========================================

const STORAGE_KEY =
  "marketlens:current-analysis:v1";

const STORAGE_VERSION = 1;
const MAX_SUGGESTED_PRICES = 20;

const EMPTY_ANALYSIS = {
  product: null,
  prediction: null,
  scoredProduct: null,
  forecast: null,
  suggestedPrices: {},
};

// ========================================
// RESTORE PREVIOUS ANALYSIS
// ========================================

function loadStoredAnalysis(userId) {
  try {
    if (!userId) {
      localStorage.removeItem(STORAGE_KEY);
      return { ...EMPTY_ANALYSIS };
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
      return { ...EMPTY_ANALYSIS };
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
      suggestedPrices: isObjectOrNull(
        saved.suggestedPrices
      )
        ? saved.suggestedPrices ?? {}
        : {},
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

// ========================================
// APPLICATION BACKGROUND
// ========================================

function AppLayout({ children }) {
  const location = useLocation();

  const isAuthPage =
    location.pathname === "/login" ||
    location.pathname === "/signup";

  const backgroundClass = isAuthPage
    ? "bg-background text-foreground"
    : "bg-gradient-to-b from-[#F8FAFC] to-[#DCE3EA]";

  return (
    <div
      className={`flex min-h-screen flex-col ${backgroundClass}`}
    >
      {children}
    </div>
  );
}

// ========================================
// FIREBASE SETUP NOTICE
// ========================================

function FirebaseSetupNotice() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div
        role="alert"
        className="rounded-lg border border-border bg-card p-6"
      >
        <h1 className="mb-3 text-xl font-semibold">
          Firebase setup required
        </h1>

        <p>{firebaseSetupMessage}</p>
      </div>

      <Link
        to="/#try"
        className="mt-4 inline-block font-medium underline"
      >
        Try the demo without an account
      </Link>
    </main>
  );
}

// ========================================
// FORECAST SAVE BUTTON PLACEMENT
// ========================================

function ForecastSaveAction({ forecast }) {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    if (
      !forecast ||
      !["existing", "launch"].includes(
        forecast.type
      )
    ) {
      return;
    }

    // Schedule the DOM lookup after rendering.
    // This avoids setting React state directly
    // inside the effect body.

    const frameId = requestAnimationFrame(() => {
      const productSection =
        document.querySelector(
          "main header .border-l-2"
        );

      setTarget(productSection);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [forecast]);

  if (!target || !forecast) {
    return null;
  }

  return createPortal(
    <div className="mt-4">
      <SaveProductButton
        key={JSON.stringify(forecast)}
        forecast={forecast}
      />
    </div>,
    target
  );
}

// ========================================
// MAIN APPLICATION
// ========================================

export default function App() {
  const activeSession = useRef(null);

  const [
    { session, analysis },
    setAnalysisState,
  ] = useState({
    session: null,
    analysis: EMPTY_ANALYSIS,
  });

  const userId = auth
    ? session?.userId
    : null;

  // ========================================
  // FIREBASE AUTHENTICATION
  // ========================================

  useEffect(() => {
    if (!auth) return;

    function updateSession(user) {
      const nextSession = {
        userId: user?.uid ?? null,
      };

      activeSession.current = nextSession;

      setAnalysisState({
        session: nextSession,
        analysis: loadStoredAnalysis(
          nextSession.userId
        ),
      });
    }

    return onAuthStateChanged(
      auth,
      updateSession,
      (error) => {
        console.error(
          "Authentication check failed:",
          error
        );

        updateSession(null);
      }
    );
  }, []);

  // ========================================
  // CURRENT ANALYSIS DATA
  // ========================================

  const {
    prediction,
    scoredProduct,
    forecast,
    suggestedPrices,
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
      saveStoredAnalysis(
        userId,
        analysis
      );
    }
  }, [analysis, session, userId]);

  // ========================================
  // UPDATE ANALYSIS STATE
  // ========================================

  function updateAnalysisField(field, value) {
    // Prevent requests from a previous session
    // from modifying the active user's analysis.

    if (
      !userId ||
      session !== activeSession.current ||
      auth.currentUser?.uid !== userId
    ) {
      return;
    }

    setAnalysisState((previous) => {
      if (
        previous.session !== session
      ) {
        return previous;
      }

      return {
        session,
        analysis: {
          ...previous.analysis,

          ...(field === "scoredProduct"
            ? { suggestedPrices: {} }
            : {}),

          [field]:
            typeof value === "function"
              ? value(
                  previous.analysis[field]
                )
              : value,
        },
      };
    });
  }

  // ========================================
  // PRODUCT SETTERS
  // ========================================

  const setProduct = (value) =>
    updateAnalysisField(
      "product",
      value
    );

  const setPrediction = (value) =>
    updateAnalysisField(
      "prediction",
      value
    );

  const setScoredProduct = (value) =>
    updateAnalysisField(
      "scoredProduct",
      value
    );

  const setForecast = (value) =>
    updateAnalysisField(
      "forecast",
      value
    );

  // ========================================
  // SAVE SUGGESTED PRICE
  // ========================================

  function saveSuggestedPrice(price) {
    const id = crypto
      .getRandomValues(
        new Uint32Array(4)
      )
      .join("-");

    updateAnalysisField(
      "suggestedPrices",
      (previous) =>
        Object.fromEntries([
          ...Object.entries(
            previous ?? {}
          ).slice(
            -(MAX_SUGGESTED_PRICES - 1)
          ),
          [id, price],
        ])
    );

    return id;
  }

  // ========================================
  // OPEN SAVED PRODUCT ANALYSIS
  // ========================================

  function openSavedAnalysis(savedAnalysis) {
    if (
      !userId ||
      session !== activeSession.current ||
      auth.currentUser?.uid !== userId
    ) {
      return;
    }

    if (
      !savedAnalysis ||
      typeof savedAnalysis !== "object" ||
      Array.isArray(savedAnalysis)
    ) {
      return;
    }

    setAnalysisState((previous) => {
      if (
        previous.session !== session
      ) {
        return previous;
      }

      return {
        session,
        analysis: {
          product:
            savedAnalysis.product ?? null,

          prediction:
            savedAnalysis.prediction ?? null,

          scoredProduct:
            savedAnalysis.scoredProduct ?? null,

          forecast:
            savedAnalysis.forecast ?? null,

          suggestedPrices:
            savedAnalysis.suggestedPrices ?? {},
        },
      };
    });
  }

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
      <AppLayout>

        {/* CONDITIONAL NAVIGATION */}

        <AppHeader userId={userId} />

        {/* PAGE CONTENT */}

        <div className="w-full flex-1">
          <Routes>

            {/* LANDING PAGE */}

            <Route
              path="/"
              element={
                <LandingPage
                  userId={userId}
                />
              }
            />

            {/* USER SIGN UP */}

            <Route
              path="/signup"
              element={
                auth ? (
                  <SignUp />
                ) : (
                  <FirebaseSetupNotice />
                )
              }
            />

            {/* USER LOGIN */}

            <Route
              path="/login"
              element={
                auth ? (
                  <Login />
                ) : (
                  <FirebaseSetupNotice />
                )
              }
            />

            {/* DISCOVER PRODUCTS */}

            <Route
              path="/discover"
              element={
                <ProtectedRoute
                  userId={userId}
                >
                  <Discover
                    setProduct={setProduct}
                    setPrediction={setPrediction}
                    setScoredProduct={
                      setScoredProduct
                    }
                    setForecast={setForecast}
                  />
                </ProtectedRoute>
              }
            />

            {/* SAVED PRODUCTS */}

            <Route
              path="/saved-products"
              element={
                <ProtectedRoute
                  userId={userId}
                >
                  <SavedProducts
                    key={userId}
                    onOpenAnalysis={
                      openSavedAnalysis
                    }
                  />
                </ProtectedRoute>
              }
            />

            {/* PROFILE MANAGEMENT */}

            <Route
              path="/profile"
              element={
                <ProtectedRoute
                  userId={userId}
                >
                  <Profile key={userId} />
                </ProtectedRoute>
              }
            />

            {/* PRODUCT OPPORTUNITY ANALYSIS */}

            <Route
              path="/product-overview"
              element={
                <ProtectedRoute
                  userId={userId}
                >
                  <Overview
                    product={scoredProduct}
                    prediction={prediction}
                    forecast={forecast}
                    saveSuggestedPrice={
                      saveSuggestedPrice
                    }
                  />
                </ProtectedRoute>
              }
            />

            {/* SALES AND LAUNCH FORECASTING */}

            <Route
              path="/sales-forecast-overview"
              element={
                <ProtectedRoute
                  userId={userId}
                >
                  <>
                    {forecast?.type ===
                    "launch" ? (
                      <LaunchForecastOverview
                        forecast={forecast}
                      />
                    ) : (
                      <SalesForecastOverview
                        forecast={forecast}
                      />
                    )}

                    {forecast &&
                      [
                        "existing",
                        "launch",
                      ].includes(
                        forecast.type
                      ) && (
                        <ForecastSaveAction
                          key={JSON.stringify(
                            forecast
                          )}
                          forecast={forecast}
                        />
                      )}
                  </>
                </ProtectedRoute>
              }
            />

            {/* LEGACY OVERVIEW REDIRECT */}

            <Route
              path="/overview"
              element={
                <ProtectedRoute
                  userId={userId}
                >
                  <Navigate
                    to={
                      overviewDestination
                    }
                    replace
                  />
                </ProtectedRoute>
              }
            />

            {/* SCORE EXPLANATIONS */}

            <Route
              path="/score-details"
              element={
                <ProtectedRoute
                  userId={userId}
                >
                  <ScoreDetails
                    product={scoredProduct}
                    prediction={prediction}
                  />
                </ProtectedRoute>
              }
            />

            {/* WHAT-IF PRICE SIMULATOR */}

            <Route
              path="/launch-feasibility"
              element={
                <ProtectedRoute
                  userId={userId}
                >
                  <LaunchFeasibility
                    key={
                      scoredProduct
                        ? JSON.stringify(
                            scoredProduct
                          )
                        : "no-product"
                    }
                    product={
                      scoredProduct
                    }
                    prediction={
                      prediction
                    }
                    suggestedPrices={
                      suggestedPrices
                    }
                  />
                </ProtectedRoute>
              }
            />

            {/* FALLBACK ROUTE */}

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

      </AppLayout>
    </BrowserRouter>
  );
}
