
import { useEffect, useMemo, useState } from "react";

import { FORECAST_CATEGORIES } from "../constants/forecastCategoryMap";
import { categoryUsesReviews } from "../constants/reviewCategories";
import { getForecastProducts } from "../services/forecastingApi";

const inputStyle =
  "mt-2 h-11 w-full rounded-lg border border-[#D7E0EB] " +
  "bg-white px-4 text-sm text-[#25334A] outline-none " +
  "focus:border-[#193B66] focus:ring-2 focus:ring-blue-100 " +
  "disabled:cursor-not-allowed disabled:bg-[#EEF2F6]";

const PAGE_SIZE = 500;
const MAX_SEARCH_RESULTS = 12;

const initialDetails = {
  title: "",
  category: "",
  price: "",
  list_price: "",
  review_count: "0",
  stars: "",
};

const initialLaunch = {
  name: "",
  category: "",
  price: "",
  list_price: "",
  review_count: "0",
  months_on_market: "0",
};
// ----------------------------------------
// SEARCH HELPERS
// ----------------------------------------

// Splits "boAt Bassheads 100 ... Mic(Furious Red)" into
// base: "boAt Bassheads 100 ... Mic" and variant: "Furious Red"
function splitVariant(name) {
  const match = name.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
  if (!match) return { base: name, variant: null };
  return { base: match[1].trim(), variant: match[2].trim() };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Higher score = better match. 0 = not a match.
function matchScore(product, query) {
  const name = product.product_name.toLowerCase();
  const id = product.product_id.toLowerCase();

  if (id === query) return 100;

  const words = query.split(/\s+/).filter(Boolean);
  const allWordsFound = words.every(
    (word) => name.includes(word) || id.includes(word)
  );
  if (!allWordsFound) return 0;

  let score = 10;
  if (name.startsWith(query)) score += 50;

  // Bonus when a word matches the START of a word in the name
  // ("head" -> "Headphones" beats "Bassheads")
  for (const word of words) {
    if (new RegExp(`\\b${escapeRegExp(word)}`).test(name)) {
      score += 10;
    }
  }

  return score;
}

// Bolds the part of the text that matches what the user typed
function Highlight({ text, query }) {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp);

  if (words.length === 0) return text;

  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-[#FFF3CC] text-inherit">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
// ----------------------------------------
// SELECTION CARD
// ----------------------------------------

function SelectionCard({
  selected,
  title,
  description,
  features = [],
  icon,
  accent = "navy",
  onClick,
}) {
  const gold = accent === "gold";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-xl border-2 bg-white p-5 text-left transition-all hover:shadow-md ${
        selected
          ? gold
            ? "border-[#D4A529] bg-[#FFFCF4] ring-2 ring-amber-100"
            : "border-[#193B66] bg-[#FBFDFF] ring-2 ring-blue-100"
          : "border-[#D7E0EB] hover:border-[#B7C6D6]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${
            gold
              ? "bg-[#FFF3CC] text-[#9B741A]"
              : "bg-[#EAF1FA] text-[#193B66]"
          }`}
          aria-hidden="true"
        >
          {icon}
        </div>

        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
            selected
              ? gold
                ? "border-[#D4A529] bg-[#D4A529] text-white"
                : "border-[#193B66] bg-[#193B66] text-white"
              : "border-[#BDC8D5]"
          }`}
          aria-hidden="true"
        >
          {selected ? "✓" : ""}
        </span>
      </div>

      <h3 className="mt-5 text-xl font-bold text-[#25334A]">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[#61738B]">
        {description}
      </p>

      {features.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-[#E7ECF3] pt-4">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-start gap-2 text-sm text-[#475569]"
            >
              <span
                className={
                  gold
                    ? "font-bold text-[#B58922]"
                    : "font-bold text-[#193B66]"
                }
              >
                ✓
              </span>

              <span>{feature}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

// ----------------------------------------
// SHARED FIELD
// ----------------------------------------

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
  step,
  disabled,
}) {
  return (
    <label className="block text-sm font-medium text-[#25334A]">
      {label}

      <input
        className={inputStyle}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    </label>
  );
}

// ----------------------------------------
// PRODUCT SEARCH
// ----------------------------------------

export default function ProductSearch({
  categories = [],
  loading = false,
  onAnalyze,
}) {
  // Main model: opportunity or sales.
  const [model, setModel] = useState("opportunity");

  // Sales sub-workflow: launch or existing.
  const [forecastWorkflow, setForecastWorkflow] =
    useState("existing");

  // Preserve each form's values when switching.
  const [details, setDetails] = useState(initialDetails);
  const [launch, setLaunch] = useState(initialLaunch);

  // Existing-product catalogue.
  const [products, setProducts] = useState([]);
  const [productQuery, setProductQuery] = useState("");
  const [selectedProduct, setSelectedProduct] =
    useState(null);
  const [productId, setProductId] = useState("");

  const [showDropdown, setShowDropdown] =
    useState(false);
  const [loadingProducts, setLoadingProducts] =
    useState(false);
  const [productsError, setProductsError] =
    useState("");
  const [catalogueAttempt, setCatalogueAttempt] =
    useState(0);

  const [error, setError] = useState("");

  const isOpportunity = model === "opportunity";
  const isLaunch =
    model === "sales" && forecastWorkflow === "launch";
  const isExisting =
    model === "sales" && forecastWorkflow === "existing";

  // ----------------------------------------
  // LOAD EXISTING-PRODUCT CATALOGUE
  // ----------------------------------------

  useEffect(() => {
    if (!isExisting || products.length > 0) {
      return;
    }

    let active = true;

    async function loadProducts() {
      setLoadingProducts(true);
      setProductsError("");

      try {
        const allProducts = [];
        let offset = 0;
        let total = Infinity;

        while (offset < total) {
          const response = await getForecastProducts(
            offset,
            PAGE_SIZE
          );

          if (!Array.isArray(response?.items)) {
            throw new Error(
              "Unexpected response from the product catalogue."
            );
          }

          const items = response.items;
          allProducts.push(...items);

          const reportedTotal = Number(response.total);
          total = Number.isFinite(reportedTotal)
            ? reportedTotal
            : Infinity;

          if (
            items.length === 0 ||
            items.length < PAGE_SIZE
          ) {
            break;
          }

          offset += items.length;
        }

        if (!active) return;

        const unique = new Map();

        for (const product of allProducts) {
          const id = String(
            product.product_id ?? ""
          ).trim();

          const name = String(
            product.product_name ?? ""
          ).trim();

          if (id && name && !unique.has(id)) {
            unique.set(id, {
              ...product,
              product_id: id,
              product_name: name,
            });
          }
        }

        setProducts(
          Array.from(unique.values()).sort((a, b) =>
            a.product_name.localeCompare(b.product_name)
          )
        );
      } catch (err) {
        if (active) {
          setProductsError(
            err.message ||
              "Unable to retrieve products."
          );
        }
      } finally {
        if (active) {
          setLoadingProducts(false);
        }
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, [isExisting, products.length, catalogueAttempt]);

    // Groups color/size variants together and ranks best matches first
  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();

    if (!query) return [];

    const groups = new Map();

    for (const product of products) {
      const score = matchScore(product, query);
      if (score === 0) continue;

      const { base, variant } = splitVariant(product.product_name);
      const key = base.toLowerCase();

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          base,
          score,
          category: product.us_category,
          variants: [],
        });
      }

      const group = groups.get(key);
      group.score = Math.max(group.score, score);
      group.variants.push({ ...product, variant });
    }

    return Array.from(groups.values())
      .sort((a, b) => b.score - a.score || a.base.localeCompare(b.base))
      .slice(0, MAX_SEARCH_RESULTS);
  }, [products, productQuery]);

  // ----------------------------------------
  // STATE HELPERS
  // ----------------------------------------

  function selectModel(value) {
    if (loading) return;

    setModel(value);
    setShowDropdown(false);
    setError("");
  }

  function selectWorkflow(value) {
    if (loading) return;

    setForecastWorkflow(value);
    setShowDropdown(false);
    setError("");
  }

  function updateDetails(field, value) {
    setDetails((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
  }

  function updateLaunch(field, value) {
    setLaunch((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
  }

  function selectScoringCategory(value) {
    const category = categories.find(
      (item) => String(item.id) === String(value)
    );

    setDetails((previous) => ({
      ...previous,
      category: value,
      stars:
        category &&
        !categoryUsesReviews(category.id)
          ? ""
          : previous.stars,
    }));

    setError("");
  }

  function handleProductSearch(value) {
    setProductQuery(value);
    setSelectedProduct(null);
    setProductId("");
    setShowDropdown(true);
    setError("");
  }

  function handleSelectProduct(product) {
    setSelectedProduct(product);
    setProductQuery(product.product_name);
    setProductId(product.product_id);
    setShowDropdown(false);
    setError("");
  }

  function handleManualProductId(value) {
    setProductId(value);
    setSelectedProduct(null);
    setProductQuery("");
    setShowDropdown(false);
    setError("");
  }

  // ----------------------------------------
  // VALIDATION
  // ----------------------------------------

  function validatePrice(priceString) {
    const price = Number(priceString);

    return (
      priceString !== "" &&
      Number.isFinite(price) &&
      price > 0 &&
      price <= 100000
    );
  }

  function validateListPrice(listPriceString, price) {
    if (listPriceString === "") return true;

    const listPrice = Number(listPriceString);

    return (
      Number.isFinite(listPrice) &&
      listPrice >= price &&
      listPrice <= 100000
    );
  }

  // ----------------------------------------
  // SUBMIT SELECTED WORKFLOW
  // ----------------------------------------

  function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setError("");

    // ======================================
    // OPPORTUNITY ANALYSIS
    // ======================================

    if (isOpportunity) {
      const category = categories.find(
        (item) =>
          String(item.id) ===
          String(details.category)
      );

      const price = Number(details.price);
      const reviews = Number(details.review_count);

      const stars =
        details.stars === ""
          ? null
          : Number(details.stars);

      if (
        !details.title.trim() ||
        details.title.trim().length > 500 ||
        !category ||
        !validatePrice(details.price) ||
        !validateListPrice(
          details.list_price,
          price
        ) ||
        details.review_count === "" ||
        !Number.isSafeInteger(reviews) ||
        reviews < 0 ||
        (stars !== null &&
          (!Number.isFinite(stars) ||
            stars < 1 ||
            stars > 5))
      ) {
        setError(
          "Complete the product details with valid values."
        );
        return;
      }

      onAnalyze({
        method: "details",
        scoringProduct: {
          title: details.title.trim(),
          category: category.id,
          categoryName: category.name,
          price,
          originalPrice:
            details.list_price === ""
              ? ""
              : Number(details.list_price),
          reviews,
          stars,
        },
      });

      return;
    }

    // ======================================
    // NEW PRODUCT LAUNCH
    // ======================================

    if (isLaunch) {
      const price = Number(launch.price);
      const reviews = Number(launch.review_count);
      const months = Number(
        launch.months_on_market
      );

      if (
        !launch.name.trim() ||
        launch.name.trim().length > 500 ||
        !FORECAST_CATEGORIES.includes(
          launch.category
        ) ||
        !validatePrice(launch.price) ||
        !validateListPrice(
          launch.list_price,
          price
        ) ||
        launch.review_count === "" ||
        !Number.isSafeInteger(reviews) ||
        reviews < 0 ||
        launch.months_on_market === "" ||
        !Number.isSafeInteger(months) ||
        months < 0
      ) {
        setError(
          "Complete the launch details with valid values."
        );
        return;
      }

      onAnalyze({
        method: "launch",
        forecastingProduct: {
          name: launch.name.trim(),
          category: launch.category,
          price,
          ...(launch.list_price !== "" && {
            list_price: Number(
              launch.list_price
            ),
          }),
          review_count: reviews,
          months_on_market: months,
        },
      });

      return;
    }

    // ======================================
    // EXISTING PRODUCT
    // ======================================

    if (isExisting) {
      const id = productId.trim();

      if (!id || id.length > 100) {
        setError(
          "Enter or select a valid Product ID."
        );
        return;
      }

      onAnalyze({
        method: "id",
        productId: id,
      });
    }
  }

  // ----------------------------------------
  // CATEGORY METADATA
  // ----------------------------------------

  const selectedCategory = categories.find(
    (item) =>
      String(item.id) ===
      String(details.category)
  );

  const reviewsUnused =
    selectedCategory &&
    !categoryUsesReviews(
      selectedCategory.id
    );

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* MAIN MODEL SELECTOR */}
      <section>
        <h2 className="text-xl font-bold text-[#25334A]">
          Choose your analysis
        </h2>

        <p className="mt-2 text-sm text-[#61738B]">
          Select the model that matches your
          product research goal.
        </p>

        <div
          className="mt-5 grid gap-5 md:grid-cols-2"
          role="group"
          aria-label="Analysis model"
        >
          <SelectionCard
            selected={isOpportunity}
            title="Opportunity Analysis"
            description="Evaluate a product idea or listing using its characteristics."
            icon="◎"
            accent="navy"
            features={[
              "Product opportunity score",
              "Positive and negative score factors",
              "What-If pricing scenarios",
            ]}
            onClick={() =>
              selectModel("opportunity")
            }
          />

          <SelectionCard
            selected={model === "sales"}
            title="Sales Forecasting"
            description="Predict demand and financial performance independently of the opportunity model."
            icon="↗"
            accent="gold"
            features={[
              "New product launch forecasts",
              "Existing product forecasts",
              "Monthly and yearly predictions",
            ]}
            onClick={() =>
              selectModel("sales")
            }
          />
        </div>
      </section>

      {/* SALES WORKFLOW SELECTOR */}
      {model === "sales" && (
        <section className="rounded-xl border border-[#E4D3A3] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-[#25334A]">
            Choose your forecasting workflow
          </h2>

          <p className="mt-2 text-sm text-[#61738B]">
            Are you forecasting a new product
            launch or an existing product?
          </p>

          <div
            className="mt-5 grid gap-4 md:grid-cols-2"
            role="group"
            aria-label="Forecasting workflow"
          >
            <SelectionCard
              selected={isLaunch}
              title="New Product Launch"
              description="Estimate performance during the first 12 and 24 months after launch."
              icon="↗"
              accent="gold"
              onClick={() =>
                selectWorkflow("launch")
              }
            />

            <SelectionCard
              selected={isExisting}
              title="Existing Product"
              description="Forecast next-month and yearly performance using a catalogue Product ID."
              icon="▣"
              accent="gold"
              onClick={() =>
                selectWorkflow("existing")
              }
            />
          </div>
        </section>
      )}

      {/* SELECTED FORM */}
      <section className="rounded-xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
        <div className="border-b border-[#E7ECF3] pb-5">
          <h2 className="text-xl font-bold text-[#25334A]">
            {isOpportunity
              ? "Opportunity Analysis"
              : isLaunch
                ? "New Product Launch"
                : "Existing Product Forecast"}
          </h2>

          <p className="mt-2 text-sm text-[#61738B]">
            {isOpportunity
              ? "Enter the product details to calculate an opportunity score."
              : isLaunch
                ? "Enter product attributes to forecast launch performance."
                : "Find a catalogue product to generate monthly and yearly forecasts."}
          </p>
        </div>

        {/* OPPORTUNITY ANALYSIS FORM */}
        {isOpportunity && (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                label="Product name"
                placeholder="Wireless Bluetooth Mouse"
                value={details.title}
                onChange={(value) =>
                  updateDetails("title", value)
                }
                disabled={loading}
              />

              <label className="block text-sm font-medium text-[#25334A]">
                Category

                <select
                  className={inputStyle}
                  value={details.category}
                  disabled={loading}
                  onChange={(event) =>
                    selectScoringCategory(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select category
                  </option>

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

              <Field
                label="Selling price (USD)"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                placeholder="24.99"
                value={details.price}
                onChange={(value) =>
                  updateDetails("price", value)
                }
                disabled={loading}
              />

              <Field
                label="List price (before discount)"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                placeholder="Optional"
                value={details.list_price}
                onChange={(value) =>
                  updateDetails(
                    "list_price",
                    value
                  )
                }
                disabled={loading}
              />

              <Field
                label="Review count"
                type="number"
                min="0"
                step="1"
                value={details.review_count}
                onChange={(value) =>
                  updateDetails(
                    "review_count",
                    value
                  )
                }
                disabled={loading}
              />

              <Field
                label="Star rating (optional)"
                type="number"
                min="1"
                max="5"
                step="0.1"
                placeholder="4.5"
                value={details.stars}
                onChange={(value) =>
                  updateDetails("stars", value)
                }
                disabled={
                  loading || reviewsUnused
                }
              />
            </div>

            {reviewsUnused ? (
              <p className="mt-5 text-xs text-[#61738B]">
                Star rating and reviews are not
                used for this category's
                opportunity score.
              </p>
            ) : (
              Number(details.review_count) > 0 &&
              details.stars === "" && (
                <p className="mt-5 text-xs text-[#61738B]">
                  Add a star rating to use your
                  review count in the score.
                  Otherwise, the product is
                  evaluated as a new idea.
                </p>
              )
            )}

            <p className="mt-6 text-xs text-[#61738B]">
              This analysis uses the Product
              Scoring model only.
            </p>
          </>
        )}

        {/* NEW PRODUCT LAUNCH FORM */}
        {isLaunch && (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                label="Product name"
                placeholder="Wireless Bluetooth Mouse"
                value={launch.name}
                onChange={(value) =>
                  updateLaunch("name", value)
                }
                disabled={loading}
              />

              <label className="block text-sm font-medium text-[#25334A]">
                Forecast category

                <select
                  className={inputStyle}
                  value={launch.category}
                  disabled={loading}
                  onChange={(event) =>
                    updateLaunch(
                      "category",
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select category
                  </option>

                  {FORECAST_CATEGORIES.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    )
                  )}
                </select>
              </label>

              <Field
                label="Expected selling price (USD)"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                placeholder="24.99"
                value={launch.price}
                onChange={(value) =>
                  updateLaunch("price", value)
                }
                disabled={loading}
              />

              <Field
                label="List price (before discount)"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                placeholder="Optional"
                value={launch.list_price}
                onChange={(value) =>
                  updateLaunch(
                    "list_price",
                    value
                  )
                }
                disabled={loading}
              />

              <Field
                label="Review count"
                type="number"
                min="0"
                step="1"
                value={launch.review_count}
                onChange={(value) =>
                  updateLaunch(
                    "review_count",
                    value
                  )
                }
                disabled={loading}
              />

              <Field
                label="Months on market"
                type="number"
                min="0"
                step="1"
                value={launch.months_on_market}
                onChange={(value) =>
                  updateLaunch(
                    "months_on_market",
                    value
                  )
                }
                disabled={loading}
              />
            </div>

            <p className="mt-6 text-xs leading-5 text-[#61738B]">
              This workflow uses the Sales
              Forecasting Launch API only.
              Predictions are model-generated
              estimates, not guaranteed results.
            </p>
          </>
        )}

        {/* EXISTING PRODUCT FORM */}
        {isExisting && (
          <>
            <div className="relative mt-6">
              <label
                htmlFor="forecast-product-search"
                className="block text-sm font-medium text-[#25334A]"
              >
                Search for a product
              </label>

              <input
                id="forecast-product-search"
                className={inputStyle}
                type="search"
                placeholder="Search by product name or ID"
                value={productQuery}
                autoComplete="off"
                disabled={loading}
                onFocus={() => {
                  if (!selectedProduct) {
                    setShowDropdown(true);
                  }
                }}
                onChange={(event) =>
                  handleProductSearch(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setShowDropdown(false);
                  }
                }}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={Boolean(
                  showDropdown &&
                    productQuery.trim() &&
                    !selectedProduct &&
                    filteredProducts.length > 0
                )}
                aria-controls="forecast-product-results"
              />

              {loadingProducts && (
                <p
                  role="status"
                  className="mt-2 text-xs text-[#61738B]"
                >
                  Loading available products...
                </p>
              )}

              {productsError && (
                <div
                  role="alert"
                  className="mt-3 text-sm text-red-700"
                >
                  <p>{productsError}</p>

                  <button
                    type="button"
                    onClick={() =>
                      setCatalogueAttempt(
                        (previous) =>
                          previous + 1
                      )
                    }
                    className="mt-2 font-semibold underline"
                  >
                    Retry loading catalogue
                  </button>
                </div>
              )}

              {!loadingProducts &&
                !productsError &&
                products.length > 0 && (
                  <p className="mt-2 text-xs text-[#61738B]">
                    {products.length} products
                    available to search.
                  </p>
                )}

              {showDropdown &&
                productQuery.trim() &&
                !selectedProduct &&
                filteredProducts.length > 0 && (
                  <ul
                    id="forecast-product-results"
                    role="listbox"
                    aria-label="Matching products"
                    className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-[#D7E0EB] bg-white shadow-lg"
                  >
                                        {filteredProducts.map((group) => {
                      const first = group.variants[0];
                      const hasVariants = group.variants.length > 1;

                      return (
                        <li
                          key={group.key}
                          role="option"
                          aria-selected={false}
                          className="border-b border-[#EEF2F6] px-4 py-3"
                        >
                          <button
                            type="button"
                            className="w-full rounded text-left hover:bg-[#F3F6FA]"
                            onClick={() => handleSelectProduct(first)}
                          >
                            <span className="block text-sm font-semibold text-[#25334A]">
                              <Highlight text={group.base} query={productQuery} />
                            </span>

                            <span className="mt-1 block text-xs text-[#61738B]">
                              {hasVariants
                                ? `${group.variants.length} variants`
                                : `ID: ${first.product_id}`}
                              {group.category && ` · ${group.category}`}
                            </span>
                          </button>

                          {hasVariants && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {group.variants.map((v) => (
                                <button
                                  key={v.product_id}
                                  type="button"
                                  title={`ID: ${v.product_id}`}
                                  onClick={() => handleSelectProduct(v)}
                                  className="rounded-full border border-[#D7E0EB] px-3 py-1 text-xs text-[#25334A] hover:border-[#D4A529] hover:bg-[#FFFAEC]"
                                >
                                  {v.variant || "Default"}
                                </button>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

              {!loadingProducts &&
                !productsError &&
                products.length > 0 &&
                showDropdown &&
                productQuery.trim() &&
                filteredProducts.length === 0 &&
                !selectedProduct && (
                  <p className="mt-2 text-xs text-[#61738B]">
                    No matching products found.
                    Try another name or enter
                    the Product ID manually.
                  </p>
                )}
            </div>

            {selectedProduct && (
              <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-[#E4D3A3] bg-[#FFFAEC] p-4">
                <div>
                  <p className="text-xs font-semibold text-[#9B741A]">
                    Selected product
                  </p>

                  <p className="mt-2 text-sm font-semibold text-[#25334A]">
                    {selectedProduct.product_name}
                  </p>

                  <p className="mt-1 text-xs text-[#61738B]">
                    Product ID:{" "}
                    {selectedProduct.product_id}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleManualProductId("")
                  }
                  aria-label="Remove selected product"
                  className="text-xl text-[#61738B] hover:text-[#25334A]"
                >
                  ×
                </button>
              </div>
            )}

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-[#D7E0EB]" />
              <span className="text-xs text-[#61738B]">
                OR
              </span>
              <div className="h-px flex-1 bg-[#D7E0EB]" />
            </div>

            <Field
              label="Enter Product ID manually"
              placeholder="e.g. B07JW9H4J1"
              value={productId}
              onChange={handleManualProductId}
              disabled={loading}
            />

            <p className="mt-2 text-xs text-[#61738B]">
              Selecting a catalogue product
              automatically fills the Product ID.
              You may also enter one directly.
            </p>

            <p className="mt-6 text-xs leading-5 text-[#61738B]">
              This workflow uses the Sales
              Forecasting Monthly and Yearly APIs.
              No opportunity score is generated.
            </p>
          </>
        )}
      </section>

      {/* VALIDATION ERROR */}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* SUBMIT BUTTON */}
      <button
        type="submit"
        disabled={loading}
        className="h-14 w-full rounded-lg bg-[#FFD45A] px-6 text-base font-semibold text-[#25334A] transition hover:bg-[#F5C842] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? isOpportunity
            ? "Analyzing Opportunity..."
            : "Generating Sales Forecast..."
          : isOpportunity
            ? "Analyze Opportunity →"
            : isLaunch
              ? "Generate Launch Forecast →"
              : "Generate Sales Forecast →"}
      </button>
    </form>
  );
}
