
import { useState } from "react";

import { toForecastCategory } from "../constants/forecastCategoryMap";
import { categoryUsesReviews } from "../constants/reviewCategories";

const inputStyle =
  "mt-2 h-11 w-full rounded-lg border border-[#D7E0EB] " +
  "bg-white px-4 text-sm text-[#25334A] outline-none " +
  "focus:border-[#193B66] focus:ring-2 focus:ring-blue-100 " +
  "disabled:cursor-not-allowed disabled:bg-[#EEF2F6]";

export default function ProductSearch({
  categories = [],
  loading = false,
  onAnalyze,
}) {
  const [method, setMethod] = useState("details");

  const [details, setDetails] = useState({
    title: "",
    category: "",
    price: "",
    review_count: "0",
    stars: "",
    months_on_market: "0",
  });

  const [productId, setProductId] = useState("");
  const [error, setError] = useState("");

  function updateDetails(field, value) {
    setDetails((previous) => ({
      ...previous,
      [field]: value,
    }));
    setError("");
  }

  // A rating doesn't carry over into a category that can't use it.
  function selectCategory(value) {
    const category = categories.find(
      (item) => String(item.id) === String(value)
    );

    setDetails((previous) => ({
      ...previous,
      category: value,
      stars:
        category && !categoryUsesReviews(category.id)
          ? ""
          : previous.stars,
    }));
    setError("");
  }

  function selectMethod(value) {
    setMethod(value);
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (method === "id") {
      const id = productId.trim();

      if (!id || id.length > 100) {
        setError("Enter a valid Product ID.");
        return;
      }

      onAnalyze({
        method: "id",
        productId: id,
      });

      return;
    }

    const price = Number(details.price);
    const reviews = Number(details.review_count);
    const months = Number(details.months_on_market);

    // Optional, so empty stays null instead of becoming 0.
    const stars =
      details.stars === "" ? null : Number(details.stars);

    const category = categories.find(
      (item) =>
        String(item.id) === String(details.category)
    );

    if (
      !details.title.trim() ||
      details.title.trim().length > 500 ||
      !category ||
      details.price === "" ||
      !Number.isFinite(price) ||
      price <= 0 ||
      price > 100000 ||
      details.review_count === "" ||
      !Number.isSafeInteger(reviews) ||
      reviews < 0 ||
      (stars !== null &&
        (!Number.isFinite(stars) || stars < 1 || stars > 5)) ||
      details.months_on_market === "" ||
      !Number.isSafeInteger(months) ||
      months < 0
    ) {
      setError(
        "Complete all product details with valid values."
      );
      return;
    }

    const forecastCategory = toForecastCategory(category.name);

    onAnalyze({
      method: "details",

      scoringProduct: {
        title: details.title.trim(),
        category: category.id,
        categoryName: category.name,
        price,
        reviews,
        stars,
      },

      // Null when the forecast doesn't cover this category.
      forecastingProduct: forecastCategory
        ? {
            name: details.title.trim(),
            category: forecastCategory,
            price,
            review_count: reviews,
            months_on_market: months,
          }
        : null,
    });
  }

  const selectedCategory = categories.find(
    (item) => String(item.id) === String(details.category)
  );

  const reviewsUnused =
    selectedCategory && !categoryUsesReviews(selectedCategory.id);

  const panelStyle = (value) =>
    `rounded-xl border bg-white p-6 transition ${
      method === value
        ? "border-[#193B66] ring-2 ring-[#193B66]/10"
        : "border-[#D7E0EB]"
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Product Details */}
        <section
          className={panelStyle("details")}
          onClick={() => selectMethod("details")}
        >
          <label className="flex cursor-pointer items-center gap-3 text-lg font-semibold text-[#25334A]">
            <input
              type="radio"
              name="searchMethod"
              checked={method === "details"}
              onChange={() => selectMethod("details")}
              className="accent-[#193B66]"
            />
            Search by Product Details
          </label>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium text-[#25334A]">
              Product name
              <input
                className={inputStyle}
                placeholder="Wireless Bluetooth Mouse"
                maxLength={500}
                value={details.title}
                onChange={(e) =>
                  updateDetails("title", e.target.value)
                }
              />
            </label>

            <div>
              <label className="block text-sm font-medium text-[#25334A]">
                Category
                <select
                  className={inputStyle}
                  value={details.category}
                  aria-describedby={
                    selectedCategory
                      ? "forecast-category-hint"
                      : undefined
                  }
                  onChange={(e) => selectCategory(e.target.value)}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCategory && (
                <p
                  id="forecast-category-hint"
                  className="mt-2 text-xs text-[#61738B]"
                >
                  Sales forecast:{" "}
                  {toForecastCategory(selectedCategory.name) ??
                    "not available for this category"}
                </p>
              )}
            </div>

            <label className="text-sm font-medium text-[#25334A]">
              Selling price (USD)
              <input
                className={inputStyle}
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                placeholder="24.99"
                value={details.price}
                onChange={(e) =>
                  updateDetails("price", e.target.value)
                }
              />
            </label>

            <label className="text-sm font-medium text-[#25334A]">
              Review count
              <input
                className={inputStyle}
                type="number"
                min="0"
                step="1"
                value={details.review_count}
                onChange={(e) =>
                  updateDetails(
                    "review_count",
                    e.target.value
                  )
                }
              />
            </label>

            <label className="text-sm font-medium text-[#25334A]">
              Star rating (optional)
              <input
                className={inputStyle}
                type="number"
                min="1"
                max="5"
                step="0.1"
                placeholder={reviewsUnused ? "" : "4.5"}
                disabled={reviewsUnused}
                value={details.stars}
                onChange={(e) =>
                  updateDetails("stars", e.target.value)
                }
              />
            </label>

            <label className="text-sm font-medium text-[#25334A]">
              Months on market
              <input
                className={inputStyle}
                type="number"
                min="0"
                step="1"
                value={details.months_on_market}
                onChange={(e) =>
                  updateDetails(
                    "months_on_market",
                    e.target.value
                  )
                }
              />
            </label>
          </div>

          {reviewsUnused ? (
            <p className="mt-6 text-xs text-[#61738B]">
              Star rating and reviews aren't used for this
              category's score.
              {toForecastCategory(selectedCategory.name) &&
                " The review count still feeds the sales forecast."}
            </p>
          ) : (
            Number(details.review_count) > 0 &&
            details.stars === "" && (
              <p className="mt-6 text-xs text-[#61738B]">
                Add a star rating to use your review count in the
                score. Scored as a new idea for now.
              </p>
            )
          )}

          <p className="mt-6 text-xs text-[#61738B]">
            Evaluates opportunity score and launch forecast.
          </p>
        </section>

        {/* Product ID */}
        <section
          className={panelStyle("id")}
          onClick={() => selectMethod("id")}
        >
          <label className="flex cursor-pointer items-center gap-3 text-lg font-semibold text-[#25334A]">
            <input
              type="radio"
              name="searchMethod"
              checked={method === "id"}
              onChange={() => selectMethod("id")}
              className="accent-[#193B66]"
            />
            Search by Product ID
          </label>

          <p className="mt-6 text-sm leading-6 text-[#61738B]">
            Enter an existing Product ID from the
            forecasting catalogue to retrieve monthly
            and yearly sales predictions.
          </p>

          <label className="mt-8 block text-sm font-medium text-[#25334A]">
            Product ID
            <input
              className={inputStyle}
              placeholder="e.g. B002PD61Y4"
              maxLength={100}
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setError("");
              }}
            />
          </label>

          <p className="mt-6 text-xs text-[#61738B]">
            Product ID searches use the forecasting API.
            Opportunity scoring requires product details.
          </p>
        </section>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* Shared CTA */}
      <button
        type="submit"
        disabled={loading}
        className="h-14 w-full rounded-lg bg-[#FFD45A] px-6 text-base font-semibold text-[#25334A] hover:bg-[#F5C842] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Analyzing..."
          : "Analyze Product / Continue →"}
      </button>
    </form>
  );
}
