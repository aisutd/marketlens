
import { useEffect, useMemo, useState } from "react";

import { toForecastCategory } from "../constants/forecastCategoryMap";
import { categoryUsesReviews } from "../constants/reviewCategories";
import { getForecastProducts } from "../services/forecastingApi";

const inputStyle =
  "mt-2 h-11 w-full rounded-lg border border-[#D7E0EB] " +
  "bg-white px-4 text-sm text-[#25334A] outline-none " +
  "focus:border-[#193B66] focus:ring-2 focus:ring-blue-100 " +
  "disabled:cursor-not-allowed disabled:bg-[#EEF2F6]";

const PAGE_SIZE = 500;
const MAX_SEARCH_RESULTS = 12;

// ----------------------------------------
// MODEL SELECTION CARD
// ----------------------------------------

function ModelCard({
  active,
  title,
  subtitle,
  eyebrow,
  features,
  icon,
  accent,
  onSelect,
}) {
  const isOpportunity = accent === "navy";

  const activeBorder = isOpportunity
    ? "border-[#193B66] ring-[#193B66]/10"
    : "border-[#D4A529] ring-[#D4A529]/15";

  const iconBackground = isOpportunity
    ? "bg-[#EAF1FA] text-[#193B66]"
    : "bg-[#FFF3CC] text-[#9B741A]";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`w-full rounded-xl border-2 bg-white p-5 text-left transition-all hover:shadow-md sm:p-6 ${
        active
          ? `${activeBorder} ring-2 shadow-sm`
          : "border-[#D7E0EB] hover:border-[#B7C6D6]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBackground}`}
        >
          {icon === "target" ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="12" cy="12" r="1" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <path d="M3 19V5" />
              <path d="M3 19h18" />
              <path d="m6 15 5-5 4 3 6-7" />
              <path d="M16 6h5v5" />
            </svg>
          )}
        </div>

        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
            active
              ? isOpportunity
                ? "border-[#193B66] bg-[#193B66]"
                : "border-[#C99A22] bg-[#C99A22]"
              : "border-[#BDC8D5]"
          }`}
          aria-hidden="true"
        >
          {active && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="m5 12 4 4L19 6" />
            </svg>
          )}
        </span>
      </div>

      <div className="mt-5">
        <p
          className={`text-[11px] font-bold uppercase tracking-wider ${
            isOpportunity
              ? "text-[#193B66]"
              : "text-[#9B741A]"
          }`}
        >
          {eyebrow}
        </p>

        <h3 className="mt-2 text-xl font-bold text-[#25334A]">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-6 text-[#61738B]">
          {subtitle}
        </p>
      </div>

      <div className="mt-5 border-t border-[#E7ECF3] pt-4">
        <p className="mb-3 text-xs font-semibold text-[#475569]">
          What you'll get
        </p>

        <div className="space-y-2">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-start gap-2"
            >
              <span
                className={`mt-0.5 text-sm font-bold ${
                  isOpportunity
                    ? "text-[#193B66]"
                    : "text-[#B58922]"
                }`}
              >
                ✓
              </span>

              <span className="text-xs leading-5 text-[#61738B]">
                {feature}
              </span>
            </div>
          ))}
        </div>
      </div>
    </button>
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
  // The selected model determines which
  // input form and submit action are shown.
  const [method, setMethod] = useState("details");

  // Product details for scoring and
  // launch forecasting.
  const [details, setDetails] = useState({
    title: "",
    category: "",
    price: "",
    list_price: "",
    review_count: "0",
    stars: "",
    months_on_market: "0",
  });

  // Existing-product catalogue search.
  const [products, setProducts] = useState([]);
  const [productQuery, setProductQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState("");

  // The ID may be selected from the catalogue
  // or entered manually.
  const [productId, setProductId] = useState("");

  const [error, setError] = useState("");

  // ----------------------------------------
  // LOAD FORECASTING CATALOGUE
  // ----------------------------------------

  // Load the catalogue when the user selects
  // Sales Forecasting.
  useEffect(() => {
    if (method !== "id" || products.length > 0) {
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

        // The API allows up to 500 products
        // per request, so retrieve each page.
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

        // Remove invalid and duplicate records.
        const uniqueProducts = new Map();

        for (const product of allProducts) {
          const id = String(
            product.product_id ?? ""
          ).trim();

          const name = String(
            product.product_name ?? ""
          ).trim();

          if (id && name && !uniqueProducts.has(id)) {
            uniqueProducts.set(id, {
              ...product,
              product_id: id,
              product_name: name,
            });
          }
        }

        const sortedProducts = Array.from(
          uniqueProducts.values()
        ).sort((a, b) =>
          a.product_name.localeCompare(b.product_name)
        );

        setProducts(sortedProducts);
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
  }, [method, products.length]);

  // ----------------------------------------
  // FILTER CATALOGUE
  // ----------------------------------------

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();

    if (!query) return [];

    return products
      .filter((product) => {
        const name =
          product.product_name.toLowerCase();

        const id =
          product.product_id.toLowerCase();

        return (
          name.includes(query) ||
          id.includes(query)
        );
      })
      .slice(0, MAX_SEARCH_RESULTS);
  }, [products, productQuery]);

  // ----------------------------------------
  // UPDATE FORM DATA
  // ----------------------------------------

  function selectMethod(value) {
    if (loading) return;

    setMethod(value);
    setError("");
    setShowDropdown(false);
  }

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
  // VALIDATION AND SUBMISSION
  // ----------------------------------------

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (loading) return;

    // SALES FORECASTING
    if (method === "id") {
      const id = productId.trim();

      if (!id || id.length > 100) {
        setError("Enter or select a valid Product ID.");
        return;
      }

      // Discover.jsx continues handling both
      // monthly and yearly POST requests.
      onAnalyze({
        method: "id",
        productId: id,
      });

      return;
    }

    // OPPORTUNITY ANALYSIS
    const price = Number(details.price);
    const reviews = Number(details.review_count);
    const months = Number(details.months_on_market);

    // Optional, so empty stays null instead of becoming 0.
    const stars =
      details.stars === ""
        ? null
        : Number(details.stars);

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
        (!Number.isFinite(stars) ||
          stars < 1 ||
          stars > 5)) ||
      details.months_on_market === "" ||
      !Number.isSafeInteger(months) ||
      months < 0
    ) {
      setError(
        "Complete all product details with valid values."
      );
      return;
    }

    // Optional, and never below what the product actually sells for.
    const listPrice =
      details.list_price === ""
        ? null
        : Number(details.list_price);

    if (
      listPrice !== null &&
      (!Number.isFinite(listPrice) ||
        listPrice < price)
    ) {
      setError(
        "List price can't be lower than the selling price."
      );
      return;
    }

    const forecastCategory = toForecastCategory(
      category.name
    );

    // Preserve the existing payload contract.
    onAnalyze({
      method: "details",

      scoringProduct: {
        title: details.title.trim(),
        category: category.id,
        categoryName: category.name,
        price,
        originalPrice: listPrice ?? "",
        reviews,
        stars,
      },

      // Null when the forecast doesn't cover this category.
      forecastingProduct: forecastCategory
        ? {
            name: details.title.trim(),
            category: forecastCategory,
            price,
            ...(listPrice !== null && {
              list_price: listPrice,
            }),
            review_count: reviews,
            months_on_market: months,
          }
        : null,
    });
  }

  // ----------------------------------------
  // CATEGORY METADATA
  // ----------------------------------------

  const selectedCategory = categories.find(
    (item) =>
      String(item.id) === String(details.category)
  );

  const reviewsUnused =
    selectedCategory &&
    !categoryUsesReviews(selectedCategory.id);

  const isOpportunity = method === "details";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* MODEL SELECTION */}
      <div>
        <h2 className="text-xl font-bold text-[#25334A]">
          Choose your analysis
        </h2>

        <p className="mt-2 text-sm text-[#61738B]">
          Select the analysis that matches your
          product research goal.
        </p>

        <div
          className="mt-5 grid gap-5 md:grid-cols-2"
          role="group"
          aria-label="Analysis model"
        >
          <ModelCard
            active={isOpportunity}
            title="Opportunity Analysis"
            eyebrow="Product intelligence"
            subtitle="Evaluate a product idea or listing using its characteristics."
            features={[
              "Product opportunity score",
              "Positive and negative score factors",
              "12- and 24-month launch estimates",
            ]}
            icon="target"
            accent="navy"
            onSelect={() => selectMethod("details")}
          />

          <ModelCard
            active={!isOpportunity}
            title="Sales Forecasting"
            eyebrow="Sales intelligence"
            subtitle="Predict sales and financial performance for an existing catalogue product."
            features={[
              "Next-month sales forecast",
              "Yearly revenue and profitability",
              "Demand analysis and trends",
            ]}
            icon="chart"
            accent="gold"
            onSelect={() => selectMethod("id")}
          />
        </div>
      </div>

      {/* SELECTED MODEL'S FORM */}
      <section
        className={`rounded-xl border bg-white p-6 shadow-sm ${
          isOpportunity
            ? "border-[#C6D5E6]"
            : "border-[#E4D3A3]"
        }`}
      >
        <div className="flex items-start gap-3 border-b border-[#E7ECF3] pb-5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              isOpportunity
                ? "bg-[#EAF1FA] text-[#193B66]"
                : "bg-[#FFF3CC] text-[#9B741A]"
            }`}
          >
            <span className="text-xl font-bold">
              {isOpportunity ? "◎" : "↗"}
            </span>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-[#25334A]">
              {isOpportunity
                ? "Opportunity Analysis"
                : "Sales Forecasting"}
            </h3>

            <p className="mt-1 text-sm text-[#61738B]">
              {isOpportunity
                ? "Enter the product's details to evaluate its market opportunity."
                : "Search an existing product to generate its monthly and yearly forecasts."}
            </p>
          </div>
        </div>

        {/* ----------------------------------------
            OPPORTUNITY ANALYSIS INPUTS
            ---------------------------------------- */}
        {isOpportunity ? (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium text-[#25334A]">
                Product name
                <input
                  className={inputStyle}
                  placeholder="Wireless Bluetooth Mouse"
                  maxLength={500}
                  value={details.title}
                  disabled={loading}
                  onChange={(event) =>
                    updateDetails(
                      "title",
                      event.target.value
                    )
                  }
                />
              </label>

              <div>
                <label className="block text-sm font-medium text-[#25334A]">
                  Category
                  <select
                    className={inputStyle}
                    value={details.category}
                    disabled={loading}
                    aria-describedby={
                      selectedCategory
                        ? "forecast-category-hint"
                        : undefined
                    }
                    onChange={(event) =>
                      selectCategory(event.target.value)
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

                {selectedCategory && (
                  <p
                    id="forecast-category-hint"
                    className="mt-2 text-xs text-[#61738B]"
                  >
                    Launch forecast category:{" "}
                    {toForecastCategory(
                      selectedCategory.name
                    ) ??
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
                  disabled={loading}
                  onChange={(event) =>
                    updateDetails(
                      "price",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="text-sm font-medium text-[#25334A]">
                List price (before discount)
                <input
                  className={inputStyle}
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Optional"
                  value={details.list_price}
                  disabled={loading}
                  onChange={(event) =>
                    updateDetails(
                      "list_price",
                      event.target.value
                    )
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
                  disabled={loading}
                  onChange={(event) =>
                    updateDetails(
                      "review_count",
                      event.target.value
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
                  placeholder={
                    reviewsUnused ? "" : "4.5"
                  }
                  disabled={loading || reviewsUnused}
                  value={details.stars}
                  onChange={(event) =>
                    updateDetails(
                      "stars",
                      event.target.value
                    )
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
                  disabled={loading}
                  onChange={(event) =>
                    updateDetails(
                      "months_on_market",
                      event.target.value
                    )
                  }
                />
              </label>
            </div>

            {reviewsUnused ? (
              <p className="mt-6 text-xs text-[#61738B]">
                Star rating and reviews aren't used
                for this category's opportunity score.
                {toForecastCategory(
                  selectedCategory.name
                ) &&
                  " The review count still feeds the launch forecast."}
              </p>
            ) : (
              Number(details.review_count) > 0 &&
              details.stars === "" && (
                <p className="mt-6 text-xs text-[#61738B]">
                  Add a star rating to use your review
                  count in the score. Scored as a new
                  idea for now.
                </p>
              )
            )}

            <p className="mt-6 text-xs text-[#61738B]">
              This analysis uses the Product Scoring
              API and, where supported, the launch
              forecasting model.
            </p>
          </>
        ) : (
          <>
            {/* ----------------------------------------
                SALES FORECASTING INPUTS
                ---------------------------------------- */}

            <div className="relative mt-6">
              <label
                htmlFor="forecast-product-search"
                className="block text-sm font-medium text-[#25334A]"
              >
                Search product by name
              </label>

              <input
                id="forecast-product-search"
                type="search"
                className={inputStyle}
                placeholder="Start typing a product name..."
                value={productQuery}
                autoComplete="off"
                disabled={loading}
                onFocus={() => {
                  if (!selectedProduct) {
                    setShowDropdown(true);
                  }
                }}
                onChange={(event) =>
                  handleProductSearch(event.target.value)
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
                <p
                  role="alert"
                  className="mt-2 text-xs text-red-600"
                >
                  {productsError}
                  {" You can still enter the Product ID manually."}
                </p>
              )}

              {!loadingProducts &&
                !productsError &&
                products.length > 0 && (
                  <p className="mt-2 text-xs text-[#61738B]">
                    {products.length} products available
                    to search.
                  </p>
                )}

              {/* MATCHING PRODUCT RESULTS */}
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
                    {filteredProducts.map(
                      (product) => (
                        <li
                          key={product.product_id}
                          role="option"
                          aria-selected={false}
                        >
                          <button
                            type="button"
                            className="w-full border-b border-[#EEF2F6] px-4 py-3 text-left hover:bg-[#F3F6FA] focus:bg-[#F3F6FA]"
                            onClick={() =>
                              handleSelectProduct(product)
                            }
                          >
                            <span className="block text-sm font-semibold text-[#25334A]">
                              {product.product_name}
                            </span>

                            <span className="mt-1 block text-xs text-[#61738B]">
                              ID: {product.product_id}
                            </span>

                            {product.us_category && (
                              <span className="mt-1 block text-xs text-[#61738B]">
                                {product.us_category}
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    )}
                  </ul>
                )}

              {/* NO MATCHES */}
              {!loadingProducts &&
                !productsError &&
                showDropdown &&
                productQuery.trim() &&
                filteredProducts.length === 0 &&
                !selectedProduct && (
                  <p
                    role="status"
                    className="mt-2 text-xs text-[#61738B]"
                  >
                    No matching products found.
                    Try another name or enter the
                    Product ID below.
                  </p>
                )}
            </div>

            {/* SELECTED PRODUCT */}
            {selectedProduct && (
              <div className="mt-4 rounded-lg border border-[#D6E6F5] bg-[#F1F7FD] p-4">
                <p className="text-xs font-semibold text-[#193B66]">
                  Selected product
                </p>

                <p className="mt-2 text-sm font-medium text-[#25334A]">
                  {selectedProduct.product_name}
                </p>

                <p className="mt-1 text-xs text-[#61738B]">
                  Product ID:{" "}
                  {selectedProduct.product_id}
                </p>
              </div>
            )}

            {/* MANUAL PRODUCT ID */}
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#D7E0EB]" />

                <span className="text-xs text-[#61738B]">
                  OR
                </span>

                <div className="h-px flex-1 bg-[#D7E0EB]" />
              </div>

              <label
                htmlFor="forecast-product-id"
                className="mt-5 block text-sm font-medium text-[#25334A]"
              >
                Product ID
              </label>

              <input
                id="forecast-product-id"
                className={inputStyle}
                placeholder="e.g. B07JW9H4J1"
                maxLength={100}
                value={productId}
                disabled={loading}
                onChange={(event) =>
                  handleManualProductId(
                    event.target.value
                  )
                }
              />

              <p className="mt-2 text-xs text-[#61738B]">
                Selecting a product automatically
                fills this field. You may also
                enter an ID directly.
              </p>
            </div>

            <p className="mt-6 text-xs text-[#61738B]">
              Existing products use the forecasting
              API. This analysis does not generate
              an opportunity score.
            </p>
          </>
        )}
      </section>

      {/* VALIDATION ERRORS */}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* MODEL-SPECIFIC SUBMIT BUTTON */}
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
            : "Generate Sales Forecast →"}
      </button>
    </form>
  );
}
