
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
  setLaunchForecast,
}) {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoriesError, setCategoriesError] =
    useState("");

  // ----------------------------------------
  // LOAD SCORING CATEGORIES
  // ----------------------------------------

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

  // ----------------------------------------
  // HANDLE ANALYSIS
  // ----------------------------------------

  async function handleAnalyze(search) {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      // ========================================
      // MODEL 1: PRODUCT OPPORTUNITY ANALYSIS
      // ========================================

      if (search.method === "details") {
        const product = search.scoringProduct;

        if (!product) {
          throw new Error(
            "Valid product details are required."
          );
        }

        // Product Scoring API only.
        const score = await predictProduct(product);

        if (!score) {
          throw new Error(
            "No opportunity score was returned."
          );
        }

        setProduct(product);
        setScoredProduct(product);
        setPrediction(score);

        // Opportunity results and existing-product
        // forecasts are kept in separate slots, so a
        // new score must not erase a saved forecast.
        // Only a legacy launch forecast belongs to the
        // previous product, so drop that one.
        setForecast((previous) =>
          previous?.type === "launch"
            ? null
            : previous
        );

        navigate("/product-overview");
      }

      // ========================================
      // MODEL 2: EXISTING PRODUCT FORECASTING
      // ========================================

      else if (search.method === "id") {
        const productId = String(
          search.productId ?? ""
        ).trim();

        if (!productId) {
          throw new Error(
            "Enter a valid Product ID."
          );
        }

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

        // Keep the current opportunity analysis
        // (product, scoredProduct, prediction) so
        // users can still return to it.
        setForecast({
          type: "existing",
          productId,
          launch: null,
          monthly,
          yearly,
          notCovered: false,
        });

        navigate("/sales-forecast-overview");
      }

      // ========================================
      // MODEL 3: NEW PRODUCT LAUNCH FORECASTING
      // ========================================

      else if (search.method === "launch") {
        const launchInput = search.forecastingProduct;

        if (!launchInput) {
          throw new Error(
            "Valid launch details are required."
          );
        }

        const result = await predictLaunch(launchInput);

        if (
          !result?.predictions ||
          typeof result.predictions !== "object"
        ) {
          throw new Error(
            "No launch forecast was returned for this product."
          );
        }

        // Stored in its own slot, so the opportunity
        // analysis and existing-product forecast are kept.
        setLaunchForecast({
          ...result,
          type: "launch",
          input: {
            ...launchInput,
            ...(result.input || {}),
          },
        });

        navigate("/launch-forecast");
      } else {
        throw new Error(
          "Unknown analysis method."
        );
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to analyze this product."
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
        onSelectionChange={() => setError("")}
      />
    </main>
  );
}
