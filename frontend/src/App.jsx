
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
import LaunchForecastOverview from "./pages/LaunchForecastOverview";
import ScoreDetails from "./pages/ScoreDetails";
import LaunchFeasibility from "./pages/LaunchFeasibility";

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

function saveStoredAnalysis(analysis) {
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

function AppHeader() {
  const location = useLocation();

  // Landing page has its own navigation.
  if (location.pathname === "/") {
    return null;
  }

  return <Header />;
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
    prediction,
    scoredProduct,
    forecast,
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

  // ========================================
  // OVERVIEW ROUTING
  // ========================================

  let overviewDestination = "/product-overview";

  if (forecast?.type === "existing") {
    overviewDestination =
      "/sales-forecast-overview";
  } else if (forecast?.type === "launch") {
    overviewDestination =
      "/launch-forecast-overview";
  }

  // ========================================
  // APPLICATION LAYOUT
  // ========================================

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#F8FAFC] to-[#DCE3EA]">

        {/* NAVIGATION */}
        <AppHeader />

        <div className="w-full flex-1">
          <Routes>

            {/* LANDING PAGE */}
            <Route
              path="/"
              element={<LandingPage />}
            />

            {/* DISCOVER PRODUCTS */}
            <Route
              path="/discover"
              element={
                <Discover
                  setProduct={setProduct}
                  setPrediction={setPrediction}
                  setScoredProduct={setScoredProduct}
                  setForecast={setForecast}
                />
              }
            />

            {/* OPPORTUNITY ANALYSIS */}
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

            {/* EXISTING PRODUCT FORECAST */}
            <Route
              path="/sales-forecast-overview"
              element={
                <SalesForecastOverview
                  forecast={forecast}
                />
              }
            />

            {/* NEW PRODUCT LAUNCH FORECAST */}
            <Route
              path="/launch-forecast-overview"
              element={
                <LaunchForecastOverview
                  forecast={forecast}
                />
              }
            />

            {/* LEGACY OVERVIEW REDIRECT */}
            <Route
              path="/overview"
              element={
                <Navigate
                  to={overviewDestination}
                  replace
                />
              }
            />

            {/* OPPORTUNITY SCORE DETAILS */}
            <Route
              path="/score-details"
              element={
                <ScoreDetails
                  product={scoredProduct}
                  prediction={prediction}
                />
              }
            />

            {/* OPPORTUNITY WHAT-IF SIMULATOR */}
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

            {/* FALLBACK */}
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

        <Footer />
      </div>
    </BrowserRouter>
  );
}
