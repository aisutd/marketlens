
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Trash2,
} from "lucide-react";

import {
  getSavedProducts,
  removeSavedProduct,
} from "../services/savedProducts";
import { auth } from "../services/firebase";

const MODEL_STYLES = {
  opportunity: {
    label: "Opportunity Score",
    className: "bg-[#DCEFE6] text-[#245B46]",
  },
  sales: {
    label: "Sales Forecast",
    className: "bg-[#E1EAF8] text-[#244D81]",
  },
  launch: {
    label: "Launch Forecast",
    className: "bg-[#F9E8D6] text-[#885321]",
  },
};

function getModel(analysis) {
  if (analysis?.forecast?.type === "launch") {
    return "launch";
  }

  if (analysis?.forecast?.type === "existing") {
    return "sales";
  }

  return "opportunity";
}

function getProductName(analysis) {
  return (
    analysis?.scoredProduct?.title ||
    analysis?.product?.title ||
    analysis?.forecast?.product?.title ||
    (analysis?.forecast?.productId
      ? `Product ${analysis.forecast.productId}`
      : null) ||
    "Untitled Product"
  );
}

function getResultDescription(analysis, model) {
  if (model === "opportunity") {
    const score = analysis?.prediction?.opportunity_score;

    return score != null && Number.isFinite(Number(score))
      ? `Opportunity Score: ${score}/100`
      : "Product opportunity analysis";
  }

  if (model === "sales") {
    return "Monthly and yearly sales projections";
  }

  return "New product launch projections";
}

function getSavedDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sortProducts(products, sortBy) {
  return [...products].sort((a, b) => {
    const nameA = getProductName(a.analysis);
    const nameB = getProductName(b.analysis);

    if (sortBy === "name-asc") {
      return nameA.localeCompare(nameB);
    }

    if (sortBy === "name-desc") {
      return nameB.localeCompare(nameA);
    }

    const dateA = Date.parse(a.savedAt) || 0;
    const dateB = Date.parse(b.savedAt) || 0;

    return sortBy === "oldest"
      ? dateA - dateB
      : dateB - dateA;
  });
}

export default function SavedProducts({ onOpenAnalysis }) {
  const navigate = useNavigate();
  const userId = auth?.currentUser?.uid;

  const [products, setProducts] = useState(() =>
    userId ? getSavedProducts(userId) : []
  );

  const [sortBy, setSortBy] = useState("newest");
  const [error, setError] = useState("");

  const sortedProducts = useMemo(
    () => sortProducts(products, sortBy),
    [products, sortBy]
  );

  function handleDelete(productId) {
    if (!userId) return;

    setError("");

    try {
      const updated = removeSavedProduct(
        userId,
        productId
      );

      setProducts(updated);
    } catch (err) {
      console.error("Unable to remove saved product:", err);
      setError("Unable to remove the product. Try again.");
    }
  }

  function handleOpen(item) {
    const analysis = item.analysis;
    const model = getModel(analysis);

    if (!analysis || !onOpenAnalysis) {
      setError("Unable to open this saved analysis.");
      return;
    }

    onOpenAnalysis(analysis);

    if (model === "opportunity") {
      navigate("/product-overview");
    } else {
      navigate("/sales-forecast-overview");
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 lg:pt-16">

        <header className="border-b border-ink pb-10">
          <p className="eyebrow text-primary">
            Your workspace
          </p>

          <h1 className="mt-6 font-display text-5xl sm:text-6xl">
            Saved Products
          </h1>

          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Revisit your product evaluations and
            forecasts whenever you need them.
          </p>
        </header>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {products.length} saved{" "}
            {products.length === 1
              ? "analysis"
              : "analyses"}
          </p>

          <div className="flex items-center gap-3">
            <label
              htmlFor="saved-products-sort"
              className="text-sm font-medium"
            >
              Sort by
            </label>

            <select
              id="saved-products-sort"
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value)
              }
              className="rounded-md border border-ink bg-card px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"
            >
              <option value="newest">
                Date: Newest first
              </option>
              <option value="oldest">
                Date: Oldest first
              </option>
              <option value="name-asc">
                Name: A–Z
              </option>
              <option value="name-desc">
                Name: Z–A
              </option>
            </select>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-6 border border-destructive p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {products.length === 0 ? (
          <section className="mt-8 flex flex-col items-center border border-ink bg-card px-6 py-16 text-center">
            <Bookmark
              size={36}
              className="text-muted-foreground"
            />

            <h2 className="mt-6 font-display text-3xl">
              No saved products yet.
            </h2>

            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Analyze a product and save its results
              to access them here.
            </p>

            <Link
              to="/discover"
              className="mt-7 inline-flex items-center gap-2 rounded-md border border-ink bg-primary px-5 py-3 font-semibold text-primary-foreground"
            >
              Discover Products
              <ArrowRight size={17} />
            </Link>
          </section>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sortedProducts.map((item) => {
              const model = getModel(item.analysis);
              const modelStyle = MODEL_STYLES[model];

              return (
                <article
                  key={item.id}
                  className="flex min-w-0 flex-col border border-ink bg-card p-6 shadow-offset-sm"
                >
                  <div>
                    <span
                      className={`inline-block rounded px-3 py-1 text-xs font-semibold ${modelStyle.className}`}
                    >
                      {modelStyle.label}
                    </span>

                    <h2 className="mt-5 break-words font-display text-2xl">
                      {getProductName(item.analysis)}
                    </h2>

                    <p className="mt-3 text-sm text-muted-foreground">
                      {getResultDescription(
                        item.analysis,
                        model
                      )}
                    </p>
                  </div>

                  <div className="mt-auto pt-8">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays size={15} />
                      Saved {getSavedDate(item.savedAt)}
                    </p>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-5">
                      <button
                        type="button"
                        onClick={() => handleOpen(item)}
                        className="inline-flex items-center gap-2 text-sm font-semibold hover:text-primary"
                      >
                        View Analysis
                        <ArrowRight size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        aria-label={`Remove ${getProductName(item.analysis)}`}
                        title="Remove saved analysis"
                        className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
