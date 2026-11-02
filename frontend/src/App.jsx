
import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Header from "./components/Header";
import Discover from "./pages/Discover";
import Overview from "./pages/Overview";
import ScoreDetails from "./pages/ScoreDetails";
import LaunchFeasibility from "./pages/LaunchFeasibility";

export default function App() {
  const [product, setProduct] = useState({
    title: "",
    category: "",
    price: "",
    brand: "",
    originalPrice: "",
  });

  const [prediction, setPrediction] = useState(null);
  const [scoredProduct, setScoredProduct] = useState(null);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-r from-[#F8FAFC] to-[#DCE3EA] text-[#0F172A]">
        <Header />

        <Routes>
          <Route
            path="/"
            element={<Navigate to="/discover" replace />}
          />

          <Route
            path="/discover"
            element={
              <Discover
                product={product}
                setProduct={setProduct}
                prediction={prediction}
                setPrediction={setPrediction}
                setScoredProduct={setScoredProduct}
              />
            }
          />

          <Route
            path="/overview"
            element={
              <Overview
                product={scoredProduct}
                prediction={prediction}
              />
            }
          />

          <Route
            path="/score-details"
            element={
              <ScoreDetails
                product={scoredProduct}
                prediction={prediction}
              />
            }
          />

          <Route
            path="/launch-feasibility"
            element={
              <LaunchFeasibility
                key={
                  scoredProduct
                    ? `${scoredProduct.title}-${scoredProduct.category}-${scoredProduct.price}-${scoredProduct.originalPrice}`
                    : "no-product"
                }
                product={scoredProduct}
                prediction={prediction}
              />
            }
          />

          <Route
            path="*"
            element={<Navigate to="/discover" replace />}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
