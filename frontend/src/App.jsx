
import { useState } from "react";

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

// Shared navigation
import Header from "./components/Header";

// Pages
import Discover from "./pages/Discover";
import Overview from "./pages/Overview";
import SalesForecastOverview from "./pages/SalesForecastOverview";
import ScoreDetails from "./pages/ScoreDetails";
import LaunchFeasibility from "./pages/LaunchFeasibility";

export default function App() {
  // Currently selected/scored product.
  const [product, setProduct] = useState(null);

  // Product opportunity scoring result.
  const [prediction, setPrediction] = useState(null);

  // Product associated with the score.
  const [scoredProduct, setScoredProduct] = useState(null);

  // Forecasting result: launch or existing product.
  const [forecast, setForecast] = useState(null);

  // Keep older links to /overview working.
  const overviewDestination =
    forecast?.type === "existing"
      ? "/sales-forecast-overview"
      : "/product-overview";

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#DCE3EA]">
        <Header />

        <Routes>
          {/* Default route */}
          <Route
            path="/"
            element={<Navigate to="/discover" replace />}
          />

          {/* Product discovery and search */}
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

          {/* Product details analysis */}
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

          {/* Existing product sales forecasting */}
          <Route
            path="/sales-forecast-overview"
            element={
              <SalesForecastOverview
                forecast={forecast}
              />
            }
          />

          {/* Compatibility with existing navigation */}
          <Route
            path="/overview"
            element={
              <Navigate
                to={overviewDestination}
                replace
              />
            }
          />

          {/* Product scoring explanations */}
          <Route
            path="/score-details"
            element={
              <ScoreDetails
                product={scoredProduct}
                prediction={prediction}
              />
            }
          />

          {/* Product pricing and scenario simulator */}
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

          {/* Unknown routes */}
          <Route
            path="*"
            element={<Navigate to="/discover" replace />}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
