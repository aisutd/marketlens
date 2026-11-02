
import { useState } from "react";

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

// Shared navigation component.
import Header from "./components/Header";

// MarketLens application pages.
import Discover from "./pages/Discover";
import Overview from "./pages/Overview";
import ScoreDetails from "./pages/ScoreDetails";
import LaunchFeasibility from "./pages/LaunchFeasibility";

/**
 * Main MarketLens application.
 *
 * Manages the current product and the independent results
 * returned by the scoring and forecasting backends.
 */
export default function App() {
  // Product details currently entered or submitted.
  const [product, setProduct] = useState(null);

  // Opportunity score returned by the product-scoring API.
  const [prediction, setPrediction] = useState(null);

  // Snapshot of the product associated with the current score.
  const [scoredProduct, setScoredProduct] = useState(null);

  // Forecasting results for launch or existing products.
  const [forecast, setForecast] = useState(null);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#DCE3EA]">
        {/* Shared navigation. */}
        <Header />

        <Routes>
          {/* Redirect the root URL to Discover. */}
          <Route
            path="/"
            element={<Navigate to="/discover" replace />}
          />

          {/* Search by product details or Product ID. */}
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

          {/* Display scoring and forecasting results. */}
          <Route
            path="/overview"
            element={
              <Overview
                product={scoredProduct}
                prediction={prediction}
                forecast={forecast}
              />
            }
          />

          {/*
            FIX: Pass both the scored product and its prediction.
            ScoreDetails needs both to display the opportunity
            score and request explanations from the scoring API.
          */}
          <Route
            path="/score-details"
            element={
              <ScoreDetails
                product={scoredProduct}
                prediction={prediction}
              />
            }
          />

          {/* Pricing scenarios for scored products only. */}
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
        </Routes>
      </div>
    </BrowserRouter>
  );
}
