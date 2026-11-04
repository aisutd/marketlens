
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

  // Load categories for product-details scoring.
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
            err.message || "Unable to load categories."
          );
        }
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  async function handleAnalyze(search) {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      // ----------------------------------------
      // MODEL 1: PRODUCT DETAILS
      // ----------------------------------------
      if (search.method === "details") {
        // A category without forecasting support
        // can still receive a product score.
        const notCovered =
          search.forecastingProduct == null;

        const [scoringResult, launchResult] =
          await Promise.allSettled([
            predictProduct(search.scoringProduct),
            notCovered
              ? Promise.resolve(null)
              : predictLaunch(
                  search.forecastingProduct
                ),
          ]);

        const score =
          scoringResult.status === "fulfilled"
            ? scoringResult.value
            : null;

        const launch =
          launchResult.status === "fulfilled"
            ? launchResult.value
            : null;

        if (score === null && launch === null) {
          throw new Error(
            notCovered
              ? "Product scoring failed. Launch forecasting is not supported for this category."
              : "Product scoring and launch forecasting both failed."
          );
        }

        // Preserve product information and scoring.
        setProduct(search.scoringProduct);
        setScoredProduct(search.scoringProduct);
        setPrediction(score);

        // Launch forecasts remain associated
        // with product-details analysis.
        setForecast({
          type: "launch",
          productId: null,
          launch,
          monthly: null,
          yearly: null,
          notCovered,
        });

        // Navigate to product overview.
        navigate("/product-overview");
      }

      // ----------------------------------------
      // MODEL 2: EXISTING PRODUCT FORECASTING
      // ----------------------------------------
      else if (search.method === "id") {
        const productId = String(
          search.productId ?? ""
        ).trim();

        if (!productId) {
          throw new Error("Enter a valid Product ID.");
        }

        // Generate forecasts independently.
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

        if (monthly === null && yearly === null) {
          throw new Error(
            "No forecasts were returned for this Product ID."
          );
        }

        // Prevent a previous product's scoring
        // data from appearing with this forecast.
        setProduct(null);
        setScoredProduct(null);
        setPrediction(null);

        // Save both forecasting responses.
        setForecast({
          type: "existing",
          productId,
          launch: null,
          monthly,
          yearly,
          notCovered: false,
        });

        // Navigate to forecasting overview.
        navigate("/sales-forecast-overview");
      }

      else {
        throw new Error("Unknown search method.");
      }
    } catch (err) {
      setError(
        err.message || "Unable to analyze this product."
      );
    } finally {
      setLoading(false);
    }
  }

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
          Evaluate a product using its details, or
          forecast sales using an existing Product ID.
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
