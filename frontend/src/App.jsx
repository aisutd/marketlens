
import { useEffect, useState } from "react";

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

// ========================================
// SHARED COMPONENTS
// ========================================

import Header from "./components/Header";

// ========================================
// PAGES
// ========================================

import LandingPage from "./pages/LandingPage";
import Discover from "./pages/Discover";
import Overview from "./pages/Overview";
import SalesForecastOverview from "./pages/SalesForecastOverview";
import ScoreDetails from "./pages/ScoreDetails";
import LaunchFeasibility from "./pages/LaunchFeasibility";
import LaunchForecastOverview from "./pages/LaunchForecastOverview";

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
  // New Product Launch results live in their own slot so
  // they never replace an opportunity score or an
  // existing-product forecast (and vice versa).
  launchForecast: null,
};

// ========================================
// RESTORE PREVIOUS ANALYSIS
// ========================================

function loadStoredAnalysis() {
  try {
    const savedData = localStorage.getItem(
      STORAGE_KEY
    );

    if (!savedData) {
      return { ...EMPTY_ANALYSIS };
    }

    const stored = JSON.parse(savedData);

    if (
      !stored ||
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
      !isObjectOrNull(saved.forecast) ||
      !isObjectOrNull(saved.launchForecast)
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

    // Older saves have no launchForecast field; that is
    // fine. A malformed one is dropped on its own so the
    // other results are still restored.
    const launchForecast =
      saved.launchForecast?.type === "launch" &&
      saved.launchForecast.predictions &&
      typeof saved.launchForecast.predictions === "object"
        ? saved.launchForecast
        : null;

    return {
      product: saved.product ?? null,
      prediction: saved.prediction ?? null,
      scoredProduct: saved.scoredProduct ?? null,
      forecast: saved.forecast ?? null,
      launchForecast,
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

function saveStoredAnalysis(analysis) {
  try {
    const hasResult = Boolean(
      analysis.product ||
        analysis.prediction ||
        analysis.scoredProduct ||
        analysis.forecast ||
        analysis.launchForecast
    );

    if (!hasResult) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const payload = {
      version: STORAGE_VERSION,
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

function AppHeader({
  hasOpportunityResult,
  hasSalesForecast,
  hasLaunchForecast,
}) {
  const location = useLocation();

  // LandingPage has its own navigation.
  // Do not display the dashboard header
  // on the landing page.

  if (location.pathname === "/") {
    return null;
  }

  return (
    <Header
      hasOpportunityResult={hasOpportunityResult}
      hasSalesForecast={hasSalesForecast}
      hasLaunchForecast={hasLaunchForecast}
    />
  );
}

// ========================================
// COPYRIGHT FOOTER
// ========================================

function Footer() {
  return (
    <footer className="mt-auto border-t border-[#D7E0EB] bg-white/50 px-6 py-6">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-medium text-[#61738B]">
          © {new Date().getFullYear()} MarketLens.
          All rights reserved.
        </p>

        <p className="text-xs text-[#94A3B8]">
          AI-Powered Product Intelligence
        </p>
      </div>
    </footer>
  );
}

// ========================================
// MAIN APPLICATION
// ========================================

export default function App() {
  const [analysis, setAnalysis] = useState(
    loadStoredAnalysis
  );

  const {
    product,
    prediction,
    scoredProduct,
    forecast,
    launchForecast,
  } = analysis;

  // ========================================
  // PERSIST ANALYSIS STATE
  // ========================================

  useEffect(() => {
    saveStoredAnalysis(analysis);
  }, [analysis]);

  // ========================================
  // UPDATE ANALYSIS STATE
  // ========================================

  function updateAnalysisField(field, value) {
    setAnalysis((previous) => ({
      ...previous,
      [field]:
        typeof value === "function"
          ? value(previous[field])
          : value,
    }));
  }

  const setProduct = (value) =>
    updateAnalysisField("product", value);

  const setPrediction = (value) =>
    updateAnalysisField("prediction", value);

  const setScoredProduct = (value) =>
    updateAnalysisField("scoredProduct", value);

  const setForecast = (value) =>
    updateAnalysisField("forecast", value);

  const setLaunchForecast = (value) =>
    updateAnalysisField("launchForecast", value);

  // ========================================
  // OVERVIEW ROUTING
  // ========================================

  const overviewDestination =
    forecast?.type === "existing"
      ? "/sales-forecast-overview"
      : "/product-overview";

  // Show menu shortcuts only for results that exist,
  // using the same checks as the result pages.
  const opportunityScore = Number(
    prediction?.opportunity_score
  );

  const hasOpportunityResult =
    Boolean(scoredProduct) &&
    prediction?.opportunity_score != null &&
    Number.isFinite(opportunityScore);

  const hasSalesForecast =
    forecast?.type === "existing" &&
    Boolean(forecast.monthly || forecast.yearly);

  const hasLaunchForecast = Boolean(
    launchForecast?.predictions
  );

  // ========================================
  // APPLICATION LAYOUT
  // ========================================

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#F8FAFC] to-[#DCE3EA]">

        {/* CONDITIONAL NAVIGATION */}
        <AppHeader
          hasOpportunityResult={hasOpportunityResult}
          hasSalesForecast={hasSalesForecast}
          hasLaunchForecast={hasLaunchForecast}
        />

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
                DISCOVER PRODUCTS
            ======================================== */}

            <Route
              path="/discover"
              element={
                <Discover
                  setProduct={setProduct}
                  setPrediction={setPrediction}
                  setScoredProduct={setScoredProduct}
                  setForecast={setForecast}
                  setLaunchForecast={setLaunchForecast}
                />
              }
            />

            {/* ========================================
                PRODUCT OPPORTUNITY ANALYSIS
            ======================================== */}

            <Route
              path="/product-overview"
              element={
                <Overview
                  product={scoredProduct}
                  prediction={prediction}
                  forecast={forecast}
                />
              }
            />

            {/* ========================================
                EXISTING PRODUCT SALES FORECASTING
            ======================================== */}

            <Route
              path="/sales-forecast-overview"
              element={
                <SalesForecastOverview
                  forecast={forecast}
                />
              }
            />

            {/* ========================================
                NEW PRODUCT LAUNCH FORECAST
            ======================================== */}

            <Route
              path="/launch-forecast"
              element={
                <LaunchForecastOverview
                  launchForecast={launchForecast}
                />
              }
            />

            {/* ========================================
                LEGACY OVERVIEW REDIRECT
            ======================================== */}

            <Route
              path="/overview"
              element={
                <Navigate
                  to={overviewDestination}
                  replace
                />
              }
            />

            {/* ========================================
                SCORE EXPLANATIONS
            ======================================== */}

            <Route
              path="/score-details"
              element={
                <ScoreDetails
                  product={scoredProduct}
                  prediction={prediction}
                />
              }
            />

            {/* ========================================
                WHAT-IF PRICE SIMULATOR
            ======================================== */}

            <Route
              path="/launch-feasibility"
              element={
                <LaunchFeasibility
                  key={
                    scoredProduct
                      ? JSON.stringify(scoredProduct)
                      : "no-product"
                  }
                  product={scoredProduct}
                  prediction={prediction}
                />
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
