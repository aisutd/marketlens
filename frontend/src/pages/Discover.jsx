
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ProductSearch from "../components/ProductSearch";

import {
  getCategories,
  predictProduct,
} from "../services/marketlensApi";

import {
  predictLaunch,
  predictMonthly,
  predictYearly,
} from "../services/forecastingApi";

export default function Discover({
  setProduct,
  setPrediction,
  setScoredProduct,
  setForecast,
}) {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoriesError, setCategoriesError] =
    useState("");

  // ========================================
  // LOAD OPPORTUNITY SCORE CATEGORIES
  // ========================================

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const result = await getCategories();

        if (active) {
          setCategories(
            Array.isArray(result) ? result : []
          );
        }
      } catch (err) {
        if (active) {
          setCategoriesError(
            err.message ||
              "Unable to load categories."
          );
        }
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  // ========================================
  // HANDLE ALL THREE WORKFLOWS
  // ========================================

  async function handleAnalyze(search) {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      // ====================================
      // MODEL 1: OPPORTUNITY ANALYSIS
      // ====================================

      if (search.method === "details") {
        const product = search.scoringProduct;

        if (!product) {
          throw new Error(
            "Valid product details are required."
          );
        }

        // Uses the Product Success API only.
        const score = await predictProduct(product);

        if (!score) {
          throw new Error(
            "No opportunity score was returned."
          );
        }

        // Store opportunity model results.
        setProduct(product);
        setScoredProduct(product);
        setPrediction(score);

        // Clear previous sales forecasting results.
        setForecast(null);

        navigate("/product-overview");
        return;
      }

      // ====================================
      // MODEL 2A: NEW PRODUCT LAUNCH
      // ====================================

      if (search.method === "launch") {
        const product = search.forecastingProduct;

        if (!product) {
          throw new Error(
            "Valid launch product details are required."
          );
        }

        // Uses the Sales Forecasting API only.
        // POST /api/v1/predictions/launch
        const launchResult = await predictLaunch(
          product
        );

        if (
          !launchResult ||
          !launchResult.predictions
        ) {
          throw new Error(
            "No launch forecast was returned."
          );
        }

        // Clear opportunity scoring data.
        // The two models remain independent.
        setProduct(null);
        setScoredProduct(null);
        setPrediction(null);

        // Store the launch forecast.
        setForecast({
          type: "launch",
          productName: product.name,
          productId: null,
          launchInput: product,
          launch: launchResult,
          monthly: null,
          yearly: null,
          notCovered: false,
        });

        // Open dedicated launch results dashboard.
        navigate("/launch-forecast-overview");
        return;
      }

      // ====================================
      // MODEL 2B: EXISTING PRODUCT FORECAST
      // ====================================

      if (search.method === "id") {
        const productId = String(
          search.productId ?? ""
        ).trim();

        if (!productId) {
          throw new Error(
            "Enter a valid Product ID."
          );
        }

        // Monthly and yearly forecasts are
        // independently requested.
        const [monthlyResult, yearlyResult] =
          await Promise.allSettled([
            predictMonthly(productId),
            predictYearly(productId),
          ]);

        const monthly =
          monthlyResult.status === "fulfilled"
            ? monthlyResult.value
            : null;

        const yearly =
          yearlyResult.status === "fulfilled"
            ? yearlyResult.value
            : null;

        if (
          monthly === null &&
          yearly === null
        ) {
          const firstError =
            monthlyResult.status === "rejected"
              ? monthlyResult.reason
              : yearlyResult.reason;

          throw new Error(
            firstError?.message ||
              "No forecasts were returned for this Product ID."
          );
        }

        // Clear opportunity scoring data.
        setProduct(null);
        setScoredProduct(null);
        setPrediction(null);

        setForecast({
          type: "existing",
          productId,
          productName:
            monthly?.product_name ||
            yearly?.product_name ||
            productId,
          launch: null,
          monthly,
          yearly,
          notCovered: false,
        });

        navigate("/sales-forecast-overview");
        return;
      }

      throw new Error(
        "Unknown analysis method."
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to analyze this product."
      );
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // PAGE LAYOUT
  // ========================================

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-10 lg:px-24">
      <div className="mb-8">
        <p className="mb-3 text-xs font-medium text-[#61738B]">
          Discover / Product search
        </p>

        <h1 className="text-[32px] font-bold text-[#25334A]">
          Discover products
        </h1>

        <p className="mt-2 text-base text-[#61738B]">
          Choose between independent Product
          Opportunity Analysis and Sales Forecasting.
        </p>
      </div>

      {categoriesError && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          {categoriesError}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <ProductSearch
        categories={categories}
        loading={loading}
        onAnalyze={handleAnalyze}
      />
    </main>
  );
}
