
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

export default function ProductSearch({
  categories = [],
  loading = false,
  onAnalyze,
}) {
  const [method, setMethod] = useState("details");

  // Product details for scoring and launch forecasting.
  const [details, setDetails] = useState({
    title: "",
    category: "",
    price: "",
    list_price: "",
    review_count: "0",
    stars: "",
    months_on_market: "0",
  });

  // Product catalogue search.
  const [products, setProducts] = useState([]);
  const [productQuery, setProductQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState("");

  // ID can come from selection or manual input.
  const [productId, setProductId] = useState("");
  const [error, setError] = useState("");

  // Load catalogue when the Product ID method is selected.
  useEffect(() => {
    if (method !== "id") return;

    let active = true;

    async function loadProducts() {
      setLoadingProducts(true);
      setProductsError("");

      try {
        const allProducts = [];
        let offset = 0;
        let total = Infinity;

        // Fetch every page, because the API is paginated.
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

          // Stop when the final page is reached.
          if (
            items.length === 0 ||
            items.length < PAGE_SIZE
          ) {
            break;
          }

          offset += items.length;
        }

        if (!active) return;

        // Remove invalid records and duplicate IDs.
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
            err.message || "Unable to retrieve products."
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
  }, [method]);

  // Filter the catalogue by name or product ID.
  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();

    if (!query) return [];

    return products
      .filter((product) => {
        const name = product.product_name.toLowerCase();
        const id = product.product_id.toLowerCase();

        return name.includes(query) || id.includes(query);
      })
      .slice(0, MAX_SEARCH_RESULTS);
  }, [products, productQuery]);

  function updateDetails(field, value) {
    setDetails((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
  }

  // Ratings are not used for every scoring category.
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

  // Update the search without accepting an ID yet.
  function handleProductSearch(value) {
    setProductQuery(value);
    setSelectedProduct(null);
    setProductId("");
    setShowDropdown(true);
    setError("");
  }

  // Automatically retrieve and store the selected ID.
  function handleSelectProduct(product) {
    setSelectedProduct(product);
    setProductQuery(product.product_name);
    setProductId(product.product_id);
    setShowDropdown(false);
    setError("");
  }

  // Manual ID input remains independently supported.
  function handleManualProductId(value) {
    setProductId(value);
    setSelectedProduct(null);
    setProductQuery("");
    setShowDropdown(false);
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (method === "id") {
      const id = productId.trim();

      if (!id || id.length > 100) {
        setError("Enter or select a valid Product ID.");
        return;
      }

      // Existing Discover.jsx handles the POST requests.
      onAnalyze({
        method: "id",
        productId: id,
      });

      return;
    }

    // Preserve existing product-details validation.
    const price = Number(details.price);
    const reviews = Number(details.review_count);
    const months = Number(details.months_on_market);

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

    const listPrice =
      details.list_price === ""
        ? null
        : Number(details.list_price);

    if (
      listPrice !== null &&
      (!Number.isFinite(listPrice) || listPrice < price)
    ) {
      setError(
        "List price can't be lower than the selling price."
      );
      return;
    }

    const forecastCategory = toForecastCategory(
      category.name
    );

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

  const selectedCategory = categories.find(
    (item) =>
      String(item.id) === String(details.category)
  );

  const reviewsUnused =
    selectedCategory &&
    !categoryUsesReviews(selectedCategory.id);

  const panelStyle = (value) =>
    `rounded-xl border bg-white p-6 transition ${
      method === value
        ? "border-[#193B66] ring-2 ring-[#193B66]/10"
        : "border-[#D7E0EB]"
    }`;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* PRODUCT DETAILS SECTION */}
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
                  onChange={(e) =>
                    selectCategory(e.target.value)
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
                  Sales forecast:{" "}
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
                onChange={(e) =>
                  updateDetails("price", e.target.value)
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
                onChange={(e) =>
                  updateDetails(
                    "list_price",
                    e.target.value
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
                placeholder={
                  reviewsUnused ? "" : "4.5"
                }
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
              Star rating and reviews aren't used for
              this category's score.
              {toForecastCategory(
                selectedCategory.name
              ) &&
                " The review count still feeds the sales forecast."}
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
            Evaluates opportunity score and launch
            forecast.
          </p>
        </section>

        {/* EXISTING PRODUCT FORECASTING SECTION */}
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
            Search Existing Product
          </label>

          <p className="mt-6 text-sm leading-6 text-[#61738B]">
            Search the forecasting catalogue by
            product name, or enter an existing Product
            ID to generate monthly and yearly sales
            predictions.
          </p>

          {/* SEARCHABLE PRODUCT DROPDOWN */}
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
                selectMethod("id");
                if (!selectedProduct) {
                  setShowDropdown(true);
                }
              }}
              onChange={(e) =>
                handleProductSearch(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowDropdown(false);
                }
              }}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={
                showDropdown &&
                productQuery.trim().length > 0 &&
                !selectedProduct &&
                filteredProducts.length > 0
              }
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
                  {filteredProducts.map((product) => (
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
                  ))}
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
                  Try another name or enter the ID below.
                </p>
              )}
          </div>

          {/* SELECTED PRODUCT CONFIRMATION */}
          {selectedProduct && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold text-[#193B66]">
                Selected product
              </p>

              <p className="mt-2 text-sm font-medium text-[#25334A]">
                {selectedProduct.product_name}
              </p>

              <p className="mt-1 text-xs text-[#61738B]">
                Product ID: {selectedProduct.product_id}
              </p>
            </div>
          )}

          {/* MANUAL PRODUCT ID ENTRY */}
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
              onChange={(e) =>
                handleManualProductId(e.target.value)
              }
            />

            <p className="mt-2 text-xs text-[#61738B]">
              Selecting a product automatically fills
              this field. You may also type an ID directly.
            </p>
          </div>

          <p className="mt-6 text-xs text-[#61738B]">
            Existing products use the forecasting API.
            Opportunity scoring requires product details.
          </p>
        </section>
      </div>

      {/* VALIDATION ERRORS */}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* SHARED ANALYSIS BUTTON */}
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
