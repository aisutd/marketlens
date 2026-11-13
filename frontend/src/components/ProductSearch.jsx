
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Search,
  Target,
  TrendingUp,
  X,
} from "lucide-react";

import { FORECAST_CATEGORIES } from "../constants/forecastCategoryMap";
import { categoryUsesReviews } from "../constants/reviewCategories";
import { getForecastProducts } from "../services/forecastingApi";

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

const inputStyle =
  "mt-2 h-12 w-full rounded-md border border-input " +
  "bg-card px-4 text-sm text-foreground outline-none " +
  "transition-[border-color,box-shadow] duration-200 " +
  "placeholder:text-muted-foreground/70 " +
  "focus:border-primary focus:ring-2 focus:ring-primary/15 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const cardHover =
  "transition-[background-color,box-shadow,transform] " +
  "duration-200 ease-out " +
  "hover:-translate-y-[2px] hover:bg-[#F8EEE0] " +
  "hover:shadow-[4px_4px_0_0_#1D150F] " +
  "motion-reduce:transform-none motion-reduce:transition-none";

function SelectionCard({
  selected,
  title,
  description,
  features = [],
  icon: Icon,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={
        "group relative flex h-full w-full flex-col " +
        "rounded-md border border-ink p-6 text-left " +
        "focus-visible:outline-2 focus-visible:outline-offset-4 " +
        "focus-visible:outline-primary " +
        (selected
          ? "bg-[#F8EEE0] shadow-offset "
          : `bg-card ${cardHover} `) +
        (disabled ? "cursor-not-allowed opacity-50 " : "")
      }
    >
      <div className="flex w-full items-start justify-between gap-4">
        <span
          className={
            "flex size-12 items-center justify-center " +
            "border border-ink transition-colors duration-200 " +
            (selected
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground")
          }
        >
          <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
        </span>

        <span
          className={
            "flex size-6 items-center justify-center rounded-full " +
            "border transition-colors duration-200 " +
            (selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-ink/40 bg-card")
          }
          aria-hidden="true"
        >
          {selected && <Check size={14} strokeWidth={2.5} />}
        </span>
      </div>

      <h3 className="mt-7 font-display text-2xl leading-tight">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {features.length > 0 && (
        <div className="mt-6 w-full space-y-3 border-t border-border pt-5">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-start gap-2.5 text-sm text-foreground"
            >
              <Check
                size={16}
                className="mt-0.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

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
  hint,
}) {
  return (
    <label className="block text-sm font-medium text-foreground">
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

      {hint && (
        <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select a category",
  disabled = false,
}) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {label}

      <span className="relative block">
        <select
          className={`${inputStyle} appearance-none pr-11`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>

          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={17}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-4 right-4 text-muted-foreground"
        />
      </span>
    </label>
  );
}

function SectionHeading({ number, title, description }) {
  return (
    <div>
      <p className="eyebrow flex items-center gap-3 text-muted-foreground">
        <span className="text-primary">{number}</span>
        <span className="h-px w-8 bg-current" />
        Analysis setup
      </p>

      <h2 className="mt-4 font-display text-3xl leading-tight">
        {title}
      </h2>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function Note({ children }) {
  return (
    <div className="mt-6 flex items-start gap-3 border-l-2 border-primary bg-secondary/60 px-4 py-3">
      <CircleHelp
        size={17}
        className="mt-0.5 shrink-0 text-primary"
        aria-hidden="true"
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

export default function ProductSearch({
  categories = [],
  loading = false,
  onAnalyze,
}) {
  const [model, setModel] = useState("opportunity");

  const [forecastWorkflow, setForecastWorkflow] =
    useState("existing");

  const [details, setDetails] = useState(initialDetails);
  const [launch, setLaunch] = useState(initialLaunch);

  const [products, setProducts] = useState([]);
  const [productQuery, setProductQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productId, setProductId] = useState("");

  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [catalogueAttempt, setCatalogueAttempt] = useState(0);

  const [error, setError] = useState("");

  const isOpportunity = model === "opportunity";
  const isLaunch =
    model === "sales" && forecastWorkflow === "launch";
  const isExisting =
    model === "sales" && forecastWorkflow === "existing";

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
  }, [isExisting, products.length, catalogueAttempt]);

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();

    if (!query) return [];

    return products
      .filter(
        (product) =>
          product.product_name
            .toLowerCase()
            .includes(query) ||
          product.product_id
            .toLowerCase()
            .includes(query)
      )
      .slice(0, MAX_SEARCH_RESULTS);
  }, [products, productQuery]);

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
        category && !categoryUsesReviews(category.id)
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

  function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setError("");

    if (isOpportunity) {
      const category = categories.find(
        (item) =>
          String(item.id) === String(details.category)
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
        !validateListPrice(details.list_price, price) ||
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

    if (isLaunch) {
      const price = Number(launch.price);
      const reviews = Number(launch.review_count);
      const months = Number(launch.months_on_market);

      if (
        !launch.name.trim() ||
        launch.name.trim().length > 500 ||
        !FORECAST_CATEGORIES.includes(launch.category) ||
        !validatePrice(launch.price) ||
        !validateListPrice(launch.list_price, price) ||
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
            list_price: Number(launch.list_price),
          }),
          review_count: reviews,
          months_on_market: months,
        },
      });

      return;
    }

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

  const selectedCategory = categories.find(
    (item) =>
      String(item.id) === String(details.category)
  );

  const reviewsUnused =
    selectedCategory &&
    !categoryUsesReviews(selectedCategory.id);

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      <section>
        <SectionHeading
          number="01"
          title="Choose your analysis."
          description="What would you like to evaluate? Select the option that best matches your goal."
        />

        <div
          className="mt-7 grid gap-5 md:grid-cols-2"
          role="group"
          aria-label="Analysis type"
        >
          <SelectionCard
            selected={isOpportunity}
            title="Opportunity Analysis"
            description="Evaluate the potential of a product idea and understand the factors influencing its score."
            icon={Target}
            features={[
              "Product opportunity score",
              "Positive and negative factors",
              "Pricing scenarios",
            ]}
            onClick={() => selectModel("opportunity")}
          />

          <SelectionCard
            selected={model === "sales"}
            title="Sales Forecasting"
            description="Explore potential sales and financial outcomes for products."
            icon={TrendingUp}
            features={[
              "Existing product forecasts",
              "Monthly and yearly projections",
              "New product launch forecasts",
            ]}
            onClick={() => selectModel("sales")}
          />
        </div>
      </section>

      {model === "sales" && (
        <section>
          <SectionHeading
            number="02"
            title="What are you forecasting?"
            description="Choose between an existing product and a potential new product launch."
          />

          <div
            className="mt-7 grid gap-5 md:grid-cols-2"
            role="group"
            aria-label="Forecasting workflow"
          >
            <SelectionCard
              selected={isExisting}
              title="Existing Product"
              description="Explore monthly and yearly forecasts for a product in the catalogue."
              icon={Search}
              onClick={() => selectWorkflow("existing")}
            />

            <SelectionCard
              selected={isLaunch}
              title="New Product Launch"
              description="Estimate sales and financial performance for a product you are planning to launch."
              icon={TrendingUp}
              onClick={() => selectWorkflow("launch")}
            />
          </div>
        </section>
      )}

      <section>
        <div className="border border-ink bg-card shadow-offset">
          <div className="border-b border-ink px-6 py-6 sm:px-8">
            <p className="eyebrow text-primary">
              {isOpportunity ? "02" : "03"} / Product information
            </p>

            <h2 className="mt-3 font-display text-3xl">
              {isOpportunity
                ? "Describe your product."
                : isLaunch
                  ? "Plan a product launch."
                  : "Find an existing product."}
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {isOpportunity
                ? "Enter the product information below to generate an opportunity score."
                : isLaunch
                  ? "Enter your proposed product details to generate financial projections."
                  : "Search the product catalogue or enter a Product ID to generate forecasts."}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {isOpportunity && (
              <>
                <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
                  <Field
                    label="Product name"
                    placeholder="Wireless Bluetooth Mouse"
                    value={details.title}
                    onChange={(value) =>
                      updateDetails("title", value)
                    }
                    disabled={loading}
                  />

                  <SelectField
                    label="Category"
                    value={details.category}
                    disabled={loading}
                    onChange={selectScoringCategory}
                    options={categories.map((category) => ({
                      value: category.id,
                      label: category.name,
                    }))}
                  />

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
                      updateDetails("list_price", value)
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
                      updateDetails("review_count", value)
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
                    disabled={loading || reviewsUnused}
                  />
                </div>

                {reviewsUnused ? (
                  <Note>
                    Star ratings and reviews are not used
                    for this category's opportunity score.
                  </Note>
                ) : (
                  Number(details.review_count) > 0 &&
                  details.stars === "" && (
                    <Note>
                      Add a star rating to include review
                      signals. Otherwise, the product is
                      evaluated as a new idea.
                    </Note>
                  )
                )}
              </>
            )}

            {isLaunch && (
              <>
                <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
                  <Field
                    label="Product name"
                    placeholder="Wireless Bluetooth Mouse"
                    value={launch.name}
                    onChange={(value) =>
                      updateLaunch("name", value)
                    }
                    disabled={loading}
                  />

                  <SelectField
                    label="Forecast category"
                    value={launch.category}
                    disabled={loading}
                    onChange={(value) =>
                      updateLaunch("category", value)
                    }
                    options={FORECAST_CATEGORIES.map(
                      (category) => ({
                        value: category,
                        label: category,
                      })
                    )}
                  />

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
                      updateLaunch("list_price", value)
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
                      updateLaunch("review_count", value)
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
                      updateLaunch("months_on_market", value)
                    }
                    disabled={loading}
                  />
                </div>

                <Note>
                  For a new product, review count and months
                  on market can describe a comparable product
                  already being sold. These inputs help
                  inform the launch projections.
                </Note>
              </>
            )}

            {isExisting && (
              <>
                <div className="relative">
                  <label
                    htmlFor="forecast-product-search"
                    className="block text-sm font-medium text-foreground"
                  >
                    Search the product catalogue
                  </label>

                  <div className="relative">
                    <Search
                      size={18}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-6 text-muted-foreground"
                    />

                    <input
                      id="forecast-product-search"
                      className={`${inputStyle} pl-11`}
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
                  </div>

                  {loadingProducts && (
                    <p
                      role="status"
                      className="mt-3 text-xs text-muted-foreground"
                    >
                      Loading available products...
                    </p>
                  )}

                  {productsError && (
                    <div
                      role="alert"
                      className="mt-4 border border-destructive bg-secondary p-4 text-sm"
                    >
                      <p>{productsError}</p>

                      <button
                        type="button"
                        onClick={() =>
                          setCatalogueAttempt(
                            (previous) => previous + 1
                          )
                        }
                        className="mt-2 font-semibold text-primary underline"
                      >
                        Retry loading catalogue
                      </button>
                    </div>
                  )}

                  {!loadingProducts &&
                    !productsError &&
                    products.length > 0 && (
                      <p className="mt-3 font-mono text-xs text-muted-foreground">
                        {products.length} products available
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
                        className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto border border-ink bg-card shadow-offset"
                      >
                        {filteredProducts.map((product) => (
                          <li
                            key={product.product_id}
                            role="option"
                            aria-selected={false}
                          >
                            <button
                              type="button"
                              className="w-full border-b border-border px-5 py-4 text-left transition-colors hover:bg-[#F8EEE0]"
                              onClick={() =>
                                handleSelectProduct(product)
                              }
                            >
                              <span className="block text-sm font-medium">
                                {product.product_name}
                              </span>

                              <span className="mt-1 block font-mono text-xs text-muted-foreground">
                                ID: {product.product_id}
                              </span>

                              {product.us_category && (
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {product.us_category}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                  {!loadingProducts &&
                    !productsError &&
                    products.length > 0 &&
                    showDropdown &&
                    productQuery.trim() &&
                    filteredProducts.length === 0 &&
                    !selectedProduct && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        No matching products found. Try another
                        name or enter the Product ID manually.
                      </p>
                    )}
                </div>

                {selectedProduct && (
                  <div className="mt-5 flex items-start justify-between gap-4 border border-ink bg-[#F8EEE0] p-5">
                    <div>
                      <p className="eyebrow text-primary">
                        Selected product
                      </p>

                      <p className="mt-3 text-sm font-semibold">
                        {selectedProduct.product_name}
                      </p>

                      <p className="mt-2 font-mono text-xs text-muted-foreground">
                        Product ID: {selectedProduct.product_id}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleManualProductId("")}
                      aria-label="Remove selected product"
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      <X size={19} />
                    </button>
                  </div>
                )}

                <div className="my-8 flex items-center gap-4">
                  <div className="h-px flex-1 bg-border" />

                  <span className="eyebrow text-muted-foreground">
                    Or enter manually
                  </span>

                  <div className="h-px flex-1 bg-border" />
                </div>

                <Field
                  label="Product ID"
                  placeholder="e.g. B07JW9H4J1"
                  value={productId}
                  onChange={handleManualProductId}
                  disabled={loading}
                  hint="Selecting a catalogue product automatically fills this field."
                />

                <Note>
                  Existing Product Forecasting generates
                  monthly and yearly projections. It does
                  not generate an opportunity score.
                </Note>
              </>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="border border-destructive bg-card p-5 text-sm shadow-offset-sm"
        >
          <p className="font-semibold text-foreground">
            Please review your information
          </p>

          <p className="mt-2 text-muted-foreground">
            {error}
          </p>
        </div>
      )}

      <div className="border-t border-ink pt-8">
        <button
          type="submit"
          disabled={loading}
          className={
            "flex min-h-14 w-full items-center justify-center gap-3 " +
            "rounded-md border border-ink bg-primary px-6 py-4 " +
            "text-base font-semibold text-primary-foreground shadow-offset " +
            "transition-all duration-150 " +
            "hover:translate-x-[2px] hover:translate-y-[2px] " +
            "hover:shadow-offset-sm " +
            "focus-visible:outline-2 focus-visible:outline-offset-4 " +
            "focus-visible:outline-primary " +
            "disabled:cursor-not-allowed disabled:opacity-50 " +
            "disabled:shadow-none"
          }
        >
          {loading
            ? isOpportunity
              ? "Analyzing opportunity..."
              : "Generating forecast..."
            : isOpportunity
              ? "Analyze opportunity"
              : isLaunch
                ? "Generate launch forecast"
                : "Generate sales forecast"}

          {!loading && (
            <ArrowRight size={19} aria-hidden="true" />
          )}
        </button>

        <p className="mt-4 text-center font-mono text-xs text-muted-foreground">
          {isOpportunity
            ? "Product opportunity analysis"
            : isLaunch
              ? "New product launch forecasting"
              : "Monthly and yearly sales forecasting"}
        </p>
      </div>
    </form>
  );
}
