
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  BarChart3,
  DollarSign,
  Package,
  TrendingUp,
  Wallet,
  Clock3,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

// ========================================
// THEME
// ========================================

const COLORS = {
  navy: "#193B66",
  gold: "#D4A529",
  green: "#13795B",
  muted: "#61738B",
};

// ========================================
// NUMBER FORMATTING
// ========================================

const currencyFormatter = new Intl.NumberFormat(
  "en-US",
  {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }
);

const numberFormatter = new Intl.NumberFormat(
  "en-US",
  {
    maximumFractionDigits: 0,
  }
);

function formatMetric(value, unit = "") {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  const numeric = Number(value);

  if (unit === "USD") {
    return currencyFormatter.format(numeric);
  }

  if (unit === "%") {
    return `${numeric.toFixed(1)}%`;
  }

  if (unit === "months") {
    return `${numeric.toFixed(1)} months`;
  }

  if (unit === "units/month") {
    return `${numberFormatter.format(numeric)} / month`;
  }

  if (unit === "lb") {
    return `${numeric.toFixed(2)} lb`;
  }

  return numberFormatter.format(numeric);
}

// "±0.0%" reads as no error at all; a small but real error
// is shown as "under ±0.1%" instead.
function formatPlusMinus(value, unit = "") {
  const numeric = Number(value);

  if (
    unit === "%" &&
    Number.isFinite(numeric) &&
    numeric > 0 &&
    numeric < 0.05
  ) {
    return "under ±0.1%";
  }

  return `±${formatMetric(value, unit)}`;
}

// API codes such as "small_standard" -> "Small standard".
function humanizeCode(value) {
  const text = String(value).replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatForecastMetric(metric) {
  if (!metric) return "—";

  return (
    metric.display ||
    formatMetric(metric.value, metric.unit)
  );
}

// ========================================
// SECTION HEADER
// ========================================

function SectionHeading({
  eyebrow,
  title,
  description,
}) {
  return (
    <div>
      {eyebrow && (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-[#A77E1C]">
          {eyebrow}
        </p>
      )}

      <h2 className="text-xl font-bold text-[#25334A] sm:text-2xl">
        {title}
      </h2>

      {description && (
        <p className="mt-2 text-sm leading-6 text-[#61738B]">
          {description}
        </p>
      )}
    </div>
  );
}

// ========================================
// FINANCIAL METRIC CARD
// ========================================

function MetricCard({
  title,
  metric,
  icon: Icon,
  accent = "navy",
}) {
  const background =
    accent === "gold"
      ? "bg-[#FFF6DB]"
      : "bg-[#EDF3FA]";

  const iconColor =
    accent === "gold"
      ? "text-[#A77E1C]"
      : "text-[#193B66]";

  return (
    <article className="rounded-2xl border border-[#D7E0EB] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-[#61738B]">
          {title}
        </p>

        <div
          className={`rounded-xl p-3 ${background} ${iconColor}`}
        >
          <Icon size={20} />
        </div>
      </div>

      <p className="mt-5 break-words text-2xl font-bold text-[#25334A]">
        {formatForecastMetric(metric)}
      </p>

      {metric?.plus_minus != null && (
        <p className="mt-2 text-xs text-[#61738B]">
          Typical error:{" "}
          {formatPlusMinus(
            metric.plus_minus,
            metric.unit
          )}
        </p>
      )}

      {Array.isArray(metric?.range) && (
        <p className="mt-2 text-xs text-[#61738B]">
          Estimated range:{" "}
          {formatMetric(
            metric.range[0],
            metric.unit
          )}
          {" – "}
          {formatMetric(
            metric.range[1],
            metric.unit
          )}
        </p>
      )}
    </article>
  );
}

// ========================================
// CHART CARD
// ========================================

function ChartCard({
  title,
  children,
}) {
  return (
    <section className="rounded-2xl border border-[#D7E0EB] bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-bold text-[#25334A]">
        {title}
      </h3>

      <div className="mt-6 h-[300px] w-full">
        {children}
      </div>
    </section>
  );
}

// ========================================
// REVENUE AND PROFIT CHART
// ========================================

function RevenueProfitChart({ predictions }) {
  const data = [
    {
      period: "12 months",
      revenue:
        predictions.revenue_12m?.value ?? 0,
      profit:
        predictions.profit_12m?.value ?? 0,
    },
    {
      period: "24 months",
      revenue:
        predictions.revenue_24m?.value ?? 0,
      profit:
        predictions.profit_24m?.value ?? 0,
    },
  ];

  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
    >
      <BarChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
        />

        <XAxis
          dataKey="period"
          tick={{ fontSize: 12 }}
        />

        <YAxis
          width={75}
          tick={{ fontSize: 11 }}
          tickFormatter={(value) =>
            `$${(value / 1000).toFixed(0)}k`
          }
        />

        <Tooltip
          formatter={(value) =>
            currencyFormatter.format(value)
          }
        />

        <Legend />

        <Bar
          dataKey="revenue"
          name="Revenue"
          fill={COLORS.navy}
          radius={[6, 6, 0, 0]}
        />

        <Bar
          dataKey="profit"
          name="Net profit"
          fill={COLORS.gold}
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ========================================
// SALES VOLUME CHART
// ========================================

function SalesVolumeChart({ predictions }) {
  const data = [
    {
      period: "12 months",
      units:
        predictions.units_sold_12m?.value ?? 0,
    },
    {
      period: "24 months",
      units:
        predictions.units_sold_24m?.value ?? 0,
    },
  ];

  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
    >
      <BarChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
        />

        <XAxis
          dataKey="period"
          tick={{ fontSize: 12 }}
        />

        <YAxis
          tick={{ fontSize: 11 }}
          width={65}
          tickFormatter={(value) =>
            numberFormatter.format(value)
          }
        />

        <Tooltip
          formatter={(value) =>
            numberFormatter.format(value)
          }
        />

        <Bar
          dataKey="units"
          name="Units sold"
          fill={COLORS.green}
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ========================================
// UNIT ECONOMICS
// ========================================

function EconomicsRow({
  label,
  value,
  unit = "USD",
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#EDF1F6] py-4 last:border-b-0">
      <span className="text-sm text-[#61738B]">
        {label}
      </span>

      <span className="text-right text-sm font-bold text-[#25334A]">
        {formatMetric(value, unit)}
      </span>
    </div>
  );
}

function UnitEconomics({ economics }) {
  if (!economics) return null;

  return (
    <section className="rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
      <SectionHeading
        eyebrow="Cost analysis"
        title="Estimated unit economics"
        description="Financial assumptions used by the forecasting model."
      />

      <div className="mt-5">
        <EconomicsRow
          label="Amazon FBA fee / unit"
          value={economics.fba_fee}
        />

        <EconomicsRow
          label="Referral fee / unit"
          value={economics.referral_fee}
        />

        <EconomicsRow
          label="Landed cost / unit"
          value={economics.landed_cost}
        />

        <EconomicsRow
          label="Launch fixed cost"
          value={economics.launch_fixed_cost}
        />

        <EconomicsRow
          label="Pre-advertising unit margin"
          value={economics.pre_ad_unit_margin_pct}
          unit="%"
        />

        <EconomicsRow
          label="Estimated shipping weight"
          value={economics.est_weight_lb}
          unit="lb"
        />
      </div>

      {economics.size_tier && (
        <p className="mt-4 text-xs text-[#61738B]">
          Size tier: {humanizeCode(economics.size_tier)}
        </p>
      )}
    </section>
  );
}

// ========================================
// BREAK EVEN AND RISK
// ========================================

function BreakEvenPanel({ predictions }) {
  const breakEven =
    predictions.break_even_months;

  const paybackRisk =
    predictions.never_breaks_even;

  const riskLevel =
    paybackRisk?.risk_level ?? "unknown";

  const riskColors = {
    low: "text-green-700 bg-green-50",
    medium: "text-amber-700 bg-amber-50",
    high: "text-red-700 bg-red-50",
    unknown: "text-slate-700 bg-slate-50",
  };

  return (
    <section className="rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
      <SectionHeading
        eyebrow="Investment risk"
        title="Break-even and payback"
        description="Estimated recovery time and potential repayment risk."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-[#EDF3FA] p-5">
          <Clock3
            size={22}
            className="text-[#193B66]"
          />

          <p className="mt-4 text-sm font-medium text-[#61738B]">
            Expected break-even
          </p>

          <p className="mt-2 text-2xl font-bold text-[#25334A]">
            {formatForecastMetric(breakEven)}
          </p>
        </div>

        <div className="rounded-xl bg-[#FFF6DB] p-5">
          <AlertTriangle
            size={22}
            className="text-[#A77E1C]"
          />

          <p className="mt-4 text-sm font-medium text-[#61738B]">
            Chance of never paying back
          </p>

          <p className="mt-2 text-2xl font-bold text-[#25334A]">
            {formatForecastMetric(paybackRisk)}
          </p>

          <span
            className={`mt-3 inline-block rounded-lg px-3 py-1 text-xs font-bold uppercase ${
              riskColors[riskLevel] ||
              riskColors.unknown
            }`}
          >
            {riskLevel} risk
          </span>
        </div>
      </div>

      <p className="mt-5 text-xs leading-5 text-[#61738B]">
        Break-even estimates are capped at
        36 months by the model. Payback risk
        is an estimated model output, not a
        guarantee of investment performance.
      </p>
    </section>
  );
}

// ========================================
// ADDITIONAL FORECAST METRICS
// ========================================

function AdditionalMetrics({ predictions }) {
  const metrics = [
    "demand_units_12m",
    "avg_monthly_demand_12m",
    "demand_share_pct_12m",
    "avg_price_12m",
  ];

  return (
    <section className="rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
      <SectionHeading
        eyebrow="Demand intelligence"
        title="Additional launch predictions"
        description="Estimated demand, category share, and selling price."
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {metrics.map((key) => {
          const metric = predictions[key];

          if (!metric) return null;

          return (
            <div
              key={key}
              className="rounded-xl bg-[#F5F8FC] p-4"
            >
              <p className="text-sm text-[#61738B]">
                {metric.label || key}
              </p>

              <p className="mt-2 text-lg font-bold text-[#25334A]">
                {formatForecastMetric(metric)}
              </p>

              {metric.plus_minus != null && (
                <p className="mt-1 text-xs text-[#61738B]">
                  Typical error:{" "}
                  {formatPlusMinus(
                    metric.plus_minus,
                    metric.unit
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ========================================
// FLOATING ABOUT THIS FORECAST
// MATCHES SALES FORECAST OVERVIEW
// ========================================

function AboutForecast({ notes }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FLOATING BUTTON */}

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="About this forecast"
        title="About this forecast"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#193B66] text-white shadow-xl ring-4 ring-white/70 transition-all duration-200 hover:-translate-y-1 hover:bg-[#275788] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#193B66]"
      >
        <svg
          viewBox="0 0 24 24"
          width="25"
          height="25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      </button>

      {/* INFORMATION DIALOG */}

      {open && (
        <div
          className="fixed inset-0 z-50"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        >
          {/* BACKDROP */}

          <button
            type="button"
            aria-label="Close forecast information"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-[#0F172A]/40 backdrop-blur-[2px]"
          />

          {/* INFORMATION PANEL */}

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="launch-forecast-info-title"
            className="absolute bottom-6 right-4 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-[440px] flex-col overflow-hidden rounded-2xl border border-[#D7E0EB] bg-white shadow-2xl sm:right-6"
          >
            {/* DIALOG HEADER */}

            <div className="flex items-start justify-between gap-4 border-b border-[#E6EDF4] bg-[#F8FAFD] p-5">
              <div>
                <h2
                  id="launch-forecast-info-title"
                  className="text-lg font-bold text-[#25334A]"
                >
                  About this forecast
                </h2>

                <p className="mt-1 text-xs text-[#61738B]">
                  Methodology, uncertainty, and model notes
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#61738B] hover:bg-[#E6EDF4]"
              >
                ✕
              </button>
            </div>

            {/* DIALOG CONTENT */}

            <div className="overflow-y-auto p-5">
              <h3 className="text-sm font-bold text-[#25334A]">
                Methodology and limitations
              </h3>

              <p className="mt-3 text-sm leading-7 text-[#61738B]">
                MarketLens forecasts are model-generated
                estimates based partly on simulated market
                and financial data. Estimated ranges describe
                typical model errors, not guaranteed
                confidence intervals.
              </p>

              <p className="mt-3 text-sm leading-7 text-[#61738B]">
                The charts and metrics reflect predictions
                for the selected forecast period. Actual
                sales and financial performance may differ.
              </p>

              <p className="mt-3 text-sm leading-7 text-[#61738B]">
                New product launch forecasts estimate
                performance during the first 12 and
                24 months after launch. These predictions
                are generated independently of the
                Product Opportunity Score model.
              </p>

              {/* API MODEL NOTES */}

              {Array.isArray(notes) &&
                notes.length > 0 && (
                  <div className="mt-5 rounded-xl bg-[#F5F8FC] p-4">
                    <h4 className="text-sm font-bold text-[#25334A]">
                      Additional model notes
                    </h4>

                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#61738B]">
                      {notes.map((note, index) => (
                        <li key={index}>
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>

            {/* DIALOG FOOTER */}

            <div className="border-t border-[#E6EDF4] p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-[#193B66] px-5 py-3 text-sm font-semibold text-white hover:bg-[#275788]"
              >
                Got it
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

// ========================================
// MAIN LAUNCH FORECAST PAGE
// ========================================

export default function LaunchForecastOverview({
  forecast,
}) {
  const [period, setPeriod] = useState("12m");

  // Only show launch forecasting results.
  // Opportunity Score and existing-product
  // forecasts must never use this dashboard.

  if (
    forecast?.type !== "launch" ||
    !forecast?.launch?.predictions
  ) {
    return (
      <main className="mx-auto max-w-[1440px] px-6 py-12">
        <div className="rounded-2xl border border-[#D7E0EB] bg-white p-8 text-center">
          <h1 className="text-2xl font-bold text-[#25334A]">
            No launch forecast available
          </h1>

          <p className="mt-3 text-sm text-[#61738B]">
            Generate a new product launch
            forecast to view predictions.
          </p>

          <Link
            to="/discover"
            className="mt-6 inline-block rounded-xl bg-[#193B66] px-6 py-3 text-sm font-semibold text-white"
          >
            Discover products
          </Link>
        </div>
      </main>
    );
  }

  // ========================================
  // FORECAST DATA
  // ========================================

  const result = forecast.launch;
  const predictions = result.predictions;
  const economics = result.unit_economics;

  const productName =
    forecast.productName ||
    result.input?.name ||
    "New product";

  const suffix =
    period === "12m" ? "12m" : "24m";

  const primaryMetrics = [
    {
      title: "Predicted revenue",
      metric: predictions[`revenue_${suffix}`],
      icon: DollarSign,
    },
    {
      title: "Predicted net profit",
      metric: predictions[`profit_${suffix}`],
      icon: Wallet,
    },
    {
      title: "Predicted units sold",
      metric: predictions[`units_sold_${suffix}`],
      icon: Package,
    },
    {
      title: "Profit margin",
      metric: predictions[`margin_pct_${suffix}`],
      icon: BarChart3,
    },
    {
      title: "Return on investment",
      metric: predictions[`roi_pct_${suffix}`],
      icon: TrendingUp,
    },
  ];

  // ========================================
  // PAGE LAYOUT
  // ========================================

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 text-[#0F172A] sm:px-8 lg:px-16 xl:px-24">

      {/* BREADCRUMB */}

      <div className="text-xs text-[#61738B]">
        Discover
        <span className="mx-3">›</span>
        Sales Forecasting
        <span className="mx-3">›</span>
        New Product Launch
      </div>

      {/* PAGE HEADER */}

      <div className="mt-6 flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-[#A77E1C]">
            MarketLens / Sales Intelligence
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#25334A] sm:text-4xl">
            Product launch forecast
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#61738B] sm:text-base">
            Predicted demand, sales, profitability,
            and investment risk for a new product.
          </p>
        </div>

        <Link
          to="/discover"
          className="inline-flex items-center gap-2 rounded-xl border border-[#D4A529] bg-white px-5 py-3 text-sm font-semibold text-[#25334A] hover:bg-[#FFFAEC]"
        >
          <ArrowLeft size={17} />
          Forecast another product
        </Link>
      </div>

      {/* PRODUCT INFORMATION */}

      <section className="mt-7 rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-[#A77E1C]">
          New product launch
        </p>

        <h2 className="mt-2 text-xl font-bold text-[#25334A]">
          {productName}
        </h2>

        <p className="mt-2 text-sm text-[#61738B]">
          Category:{" "}
          {result.input?.category ||
            forecast.launchInput?.category ||
            "Unknown"}
        </p>

        <p className="mt-1 text-sm text-[#61738B]">
          Expected selling price:{" "}
          {formatMetric(
            result.input?.price ??
              forecast.launchInput?.price,
            "USD"
          )}
        </p>
      </section>

      {/* TIME PERIOD SELECTOR */}

      <section className="mt-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="Launch performance"
            title="Prediction overview"
            description="Switch between cumulative 12-month and 24-month estimates."
          />

          <div className="inline-flex w-fit gap-1 rounded-xl border border-[#D7E0EB] bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setPeriod("12m")}
              aria-pressed={period === "12m"}
              className={`rounded-lg px-5 py-3 text-sm font-semibold ${
                period === "12m"
                  ? "bg-[#FFD45A] text-[#25334A]"
                  : "text-[#61738B] hover:bg-[#F5F8FC]"
              }`}
            >
              12 months
            </button>

            <button
              type="button"
              onClick={() => setPeriod("24m")}
              aria-pressed={period === "24m"}
              className={`rounded-lg px-5 py-3 text-sm font-semibold ${
                period === "24m"
                  ? "bg-[#FFD45A] text-[#25334A]"
                  : "text-[#61738B] hover:bg-[#F5F8FC]"
              }`}
            >
              24 months
            </button>
          </div>
        </div>

        {/* PRIMARY KPIS */}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {primaryMetrics.map((item, index) => (
            <MetricCard
              key={item.title}
              {...item}
              accent={
                index === 1 ? "gold" : "navy"
              }
            />
          ))}
        </div>
      </section>

      {/* VISUALIZATIONS */}

      <section className="mt-10">
        <SectionHeading
          eyebrow="Visual analytics"
          title="Forecast breakdown"
          description="Compare cumulative financial and unit sales predictions."
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <ChartCard title="Revenue vs. net profit">
            <RevenueProfitChart
              predictions={predictions}
            />
          </ChartCard>

          <ChartCard title="Projected units sold">
            <SalesVolumeChart
              predictions={predictions}
            />
          </ChartCard>
        </div>
      </section>

      {/* INVESTMENT INSIGHTS */}

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-2">
        <BreakEvenPanel
          predictions={predictions}
        />

        <UnitEconomics
          economics={economics}
        />
      </div>

      {/* ADDITIONAL METRICS */}

      <div className="mt-8">
        <AdditionalMetrics
          predictions={predictions}
        />
      </div>

      {/* ====================================
          FLOATING ABOUT FORECAST BUTTON
          REPLACES THE LARGE DISCLAIMER
      ==================================== */}

      <AboutForecast
        key={`about-launch-${productName}`}
        notes={result.notes}
      />

    </main>
  );
}
