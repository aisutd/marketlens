
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleHelp,
} from "lucide-react";

import InfoDialog from "../components/InfoDialog";

// ========================================
// DESIGN SYSTEM
// ========================================

const COLORS = {
  orange: "#D95332",
  ink: "#1D150F",
  muted: "#645850", // = --muted-foreground; #776C61 was 4.46:1 on the beige panels
  cream: "#F8EEE0",
  green: "#47866B",
  gray: "#AFA49A",
};

const primaryButton =
  "inline-flex items-center justify-center gap-3 " +
  "border border-ink bg-primary px-6 py-3 " +
  "font-semibold text-primary-foreground shadow-offset " +
  "transition-transform duration-150 " +
  "hover:translate-x-[2px] hover:translate-y-[2px] " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 " +
  "focus-visible:outline-primary";

const cardHover =
  "transition-[background-color,box-shadow,transform] " +
  "duration-200 hover:-translate-y-[2px] " +
  "hover:shadow-offset motion-reduce:transform-none";

// ========================================
// FORMATTING
// ========================================

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function numeric(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return Number(value);
}

function metricValue(metric) {
  return numeric(metric?.value);
}

function formatMoney(value) {
  const amount = numeric(value);

  return amount === null
    ? "—"
    : moneyFormatter.format(amount);
}

function formatNumber(value) {
  const amount = numeric(value);

  return amount === null
    ? "—"
    : numberFormatter.format(amount);
}

function formatMetric(metric, fallbackUnit) {
  const value = metricValue(metric);

  if (value === null) return "—";

  const unit = metric?.unit || fallbackUnit;

  if (unit === "USD") return formatMoney(value);
  if (unit === "%") return `${value.toFixed(1)}%`;

  if (unit === "months") {
    return `${formatNumber(value)} months`;
  }

  return formatNumber(value);
}

function validRange(metric) {
  const range = metric?.range;
  const value = metricValue(metric);

  if (
    !Array.isArray(range) ||
    range.length !== 2 ||
    value === null
  ) {
    return null;
  }

  const low = numeric(range[0]);
  const high = numeric(range[1]);

  if (
    low === null ||
    high === null ||
    low > high ||
    value < low ||
    value > high
  ) {
    return null;
  }

  return [low, high];
}

function RangeText({ metric }) {
  const range = validRange(metric);

  if (!range) return null;

  return (
    <p className="mt-3 text-xs leading-6 text-muted-foreground">
      Estimated range:{" "}
      {formatMetric({
        value: range[0],
        unit: metric.unit,
      })}
      {" – "}
      {formatMetric({
        value: range[1],
        unit: metric.unit,
      })}
    </p>
  );
}

// ========================================
// SHARED PAGE COMPONENTS
// ========================================

function SectionHeading({
  number,
  eyebrow,
  title,
  description,
}) {
  return (
    <div>
      <p className="eyebrow flex items-center gap-3 text-muted-foreground">
        <span className="text-primary">{number}</span>
        <span className="h-px w-8 bg-current" />
        {eyebrow}
      </p>

      <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
        {title}
      </h2>

      {description && (
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

function MetricCard({
  label,
  metric,
  description,
  featured = false,
}) {
  return (
    <article
      className={
        "flex min-h-48 min-w-0 flex-col justify-between border border-ink p-6 " +
        (featured ? "bg-[#F8EEE0] " : "bg-card ") +
        cardHover
      }
    >
      <p className="eyebrow text-muted-foreground">
        {label}
      </p>

      <div className="mt-8">
        <p className="break-words font-display text-3xl leading-tight sm:text-4xl">
          {formatMetric(metric)}
        </p>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>

        <RangeText metric={metric} />
      </div>
    </article>
  );
}

function ChartPanel({
  title,
  description,
  children,
}) {
  return (
    <article className="min-w-0 border border-ink bg-card p-5 sm:p-7">
      <h3 className="font-display text-2xl">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        {description}
      </p>

      <div className="mt-6">
        {children}
      </div>
    </article>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0];

  return (
    <div className="border border-ink bg-card px-4 py-3 shadow-offset">
      <p className="text-sm font-semibold">
        {entry.payload?.name || entry.name}
      </p>

      <p className="mt-2 font-mono text-sm">
        {formatMoney(entry.value)}
      </p>
    </div>
  );
}

// ========================================
// 12-MONTH / 24-MONTH COMPARISONS
// ========================================

function CumulativeComparison({
  predictions,
  field,
  title,
  description,
  footnote,
}) {
  const firstYear = metricValue(
    predictions?.[`${field}_12m`]
  );

  const firstTwoYears = metricValue(
    predictions?.[`${field}_24m`]
  );

  const data = [
    {
      name: "12 months",
      value: firstYear,
      color: COLORS.orange,
    },
    {
      name: "24 months",
      value: firstTwoYears,
      color: COLORS.ink,
    },
  ].filter((item) => item.value !== null);

  const hasData = data.length > 0;

  const minValue = Math.min(
    0,
    ...data.map((item) => item.value)
  );

  const maxValue = Math.max(
    0,
    ...data.map((item) => item.value)
  );

  return (
    <ChartPanel
      title={title}
      description={description}
    >
      {hasData ? (
        <>
          <div
            className="h-[260px] w-full"
            role="img"
            aria-label={`First 12 months: ${formatMoney(firstYear)}. First 24 months: ${formatMoney(firstTwoYears)}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                // The labelled role="img" wrapper carries the values; Recharts'
                // accessibility layer would add an unnamed role="application" tab stop.
                accessibilityLayer={false}
                data={data}
                margin={{
                  top: 14,
                  right: 12,
                  bottom: 0,
                  left: 0,
                }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#E8DED2"
                />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: COLORS.muted,
                    fontSize: 12,
                  }}
                />

                <YAxis
                  domain={[minValue, maxValue]}
                  width={68}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: COLORS.muted,
                    fontSize: 11,
                  }}
                  tickFormatter={(value) =>
                    `$${compactFormatter.format(value)}`
                  }
                />

                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: COLORS.cream }}
                />

                <Bar
                  dataKey="value"
                  maxBarSize={90}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="border border-border bg-[#F8EEE0] p-4">
              <p className="text-xs text-muted-foreground">
                First 12 months
              </p>

              <p className="mt-2 break-words font-display text-2xl">
                {formatMoney(firstYear)}
              </p>
            </div>

            <div className="border border-border bg-background p-4">
              <p className="text-xs text-muted-foreground">
                First 24 months
              </p>

              <p className="mt-2 break-words font-display text-2xl">
                {formatMoney(firstTwoYears)}
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            {footnote}
          </p>
        </>
      ) : (
        <p className="py-10 text-sm text-muted-foreground">
          A comparison is not available.
        </p>
      )}
    </ChartPanel>
  );
}

// ========================================
// PROFITABILITY
// ========================================

function ProfitabilitySection({
  predictions,
  suffix,
  period,
}) {
  const profit = metricValue(
    predictions?.[`profit_${suffix}`]
  );

  const margin = metricValue(
    predictions?.[`margin_pct_${suffix}`]
  );

  return (
    <section className="mt-14">
      <SectionHeading
        number="03"
        eyebrow="Profitability"
        title="Could this product make a profit?"
        description={`Explore the estimated earnings and investment returns over the first ${period} months.`}
      />

      <div className="mt-7 grid gap-5 md:grid-cols-3">
        <MetricCard
          label="Net profit"
          metric={predictions?.[`profit_${suffix}`]}
          description="What may remain from sales after estimated expenses."
          featured
        />

        <MetricCard
          label="Profit margin"
          metric={predictions?.[`margin_pct_${suffix}`]}
          description="How much of each sales dollar may remain after estimated costs."
        />

        <MetricCard
          label="Return on investment"
          metric={predictions?.[`roi_pct_${suffix}`]}
          description="How the estimated financial return compares with the money invested."
        />
      </div>

      <div className="mt-6 border border-ink bg-card p-6">
        <p className="font-semibold">
          What does this mean?
        </p>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {profit === null
            ? "A net profit estimate isn't available for this period."
            : profit > 0
              ? "The forecast suggests that this product could generate more revenue than its estimated costs."
              : profit < 0
                ? "The forecast suggests that costs could exceed revenue during this period."
                : "The forecast suggests that estimated revenue and costs are approximately equal."}
        </p>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {margin === null
            ? "A profit margin estimate isn't available."
            : margin > 0
              ? "A positive profit margin is encouraging, but it does not guarantee that the product is financially viable."
              : margin < 0
                ? "A negative profit margin is an important reason to investigate your pricing and costs."
                : "A zero profit margin means there is little or no estimated profit remaining."}
        </p>
      </div>
    </section>
  );
}

// ========================================
// BREAK-EVEN AND FINANCIAL RISK
// ========================================

function InvestmentOutlook({ predictions }) {
  const breakEven = predictions?.break_even_months;
  const risk = predictions?.never_breaks_even;

  const riskValue = metricValue(risk);

  const riskLevel =
    typeof risk?.risk_level === "string"
      ? risk.risk_level.toLowerCase()
      : null;

  return (
    <section className="mt-14">
      <SectionHeading
        number="04"
        eyebrow="Investment outlook"
        title="When could you recover your investment?"
        description="Understand the estimated time to break even and the possibility of not recovering your initial investment."
      />

      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <article className="border border-ink bg-[#F8EEE0] p-6">
          <p className="eyebrow text-muted-foreground">
            Estimated break-even time
          </p>

          <p className="mt-6 break-words font-display text-4xl">
            {breakEven?.display ||
              formatMetric(breakEven)}
          </p>

          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            When the product might recover its
            initial investment under the forecast
            assumptions.
          </p>

          <RangeText metric={breakEven} />
        </article>

        <article className="border border-ink bg-card p-6">
          <p className="eyebrow text-muted-foreground">
            Estimated chance of not breaking even
          </p>

          <p className="mt-6 font-display text-4xl">
            {riskValue === null
              ? "—"
              : `${riskValue.toFixed(1)}%`}
          </p>

          {riskLevel && (
            <p className="mt-3 text-sm capitalize text-muted-foreground">
              {riskLevel} risk
            </p>
          )}

          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            This estimate describes the possibility
            that the product will not recover its
            investment under the stated assumptions.
          </p>
        </article>
      </div>

      <div className="mt-6 flex items-start gap-3 border-l-2 border-primary bg-[#F8EEE0] p-5">
        <CircleAlert
          size={19}
          className="mt-0.5 shrink-0 text-primary"
        />

        <p className="text-sm leading-7 text-muted-foreground">
          Break-even estimates and risk percentages
          are not guarantees. Actual outcomes depend
          on costs, demand, pricing, and other
          business conditions.
        </p>
      </div>
    </section>
  );
}

// ========================================
// CUSTOMER DEMAND
// ========================================

function DemandSection({ predictions }) {
  return (
    <section className="mt-14">
      <SectionHeading
        number="05"
        eyebrow="Customer demand"
        title="How much interest could there be?"
        description="These demand estimates cover the first 12 months. A separate 24-month demand forecast is not available."
      />

      <div className="mt-7 grid gap-5 md:grid-cols-3">
        <MetricCard
          label="Estimated demand"
          metric={predictions?.demand_units_12m}
          description="The estimated number of units customers may want in the first year."
          featured
        />

        <MetricCard
          label="Average monthly demand"
          metric={predictions?.avg_monthly_demand_12m}
          description="Estimated average demand per month across the first year."
        />

        <MetricCard
          label="Share of category demand"
          metric={predictions?.demand_share_pct_12m}
          description="The estimated share of demand in this product category."
        />
      </div>

      <div className="mt-6 border border-ink bg-card p-6">
        <p className="font-semibold">
          Demand is not the same as sales.
        </p>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Demand estimates how many units customers
          may want. Actual sales also depend on
          factors such as availability, competition,
          and whether customers decide to buy.
        </p>
      </div>
    </section>
  );
}

// ========================================
// ADDITIONAL PRODUCT INFORMATION
// ========================================

function AdditionalDetails({
  predictions,
  product,
}) {
  const [expanded, setExpanded] = useState(false);

  const details = [
    {
      label: "Product name",
      value: product?.name || "Not provided",
    },
    {
      label: "Product category",
      value: product?.category || "Not provided",
    },
    {
      label: "Planned selling price",
      value: formatMoney(product?.price),
    },
    {
      label: "Average first-year selling price",
      value: formatMetric(
        predictions?.avg_price_12m,
        "USD"
      ),
    },
  ];

  return (
    <section className="mt-14">
      <SectionHeading
        number="06"
        eyebrow="Additional information"
        title="Review your product assumptions."
        description="Check the product details associated with this forecast."
      />

      <div className="mt-7 border border-ink bg-card">
        <button
          type="button"
          onClick={() =>
            setExpanded((value) => !value)
          }
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-4 p-6 text-left transition-colors hover:bg-[#F8EEE0]"
        >
          <div>
            <p className="font-semibold">
              Product and pricing details
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              View the information behind your
              launch forecast.
            </p>
          </div>

          {expanded ? (
            <ChevronUp size={20} />
          ) : (
            <ChevronDown size={20} />
          )}
        </button>

        {expanded && (
          <div className="grid gap-4 border-t border-border p-6 sm:grid-cols-2">
            {details.map((detail) => (
              <div
                key={detail.label}
                className="border border-border bg-background p-4"
              >
                <p className="text-xs text-muted-foreground">
                  {detail.label}
                </p>

                <p className="mt-3 break-words font-semibold">
                  {detail.value}
                </p>
              </div>
            ))}

            <p className="text-xs leading-6 text-muted-foreground sm:col-span-2">
              The average selling price is a
              first-year estimate. No separate
              24-month average price is provided.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ========================================
// PRACTICAL BUSINESS GUIDANCE
// ========================================

function NextSteps({ predictions, period }) {
  const suffix = period === "12m" ? "12m" : "24m";

  const profit = metricValue(
    predictions?.[`profit_${suffix}`]
  );

  const margin = metricValue(
    predictions?.[`margin_pct_${suffix}`]
  );

  const units = metricValue(
    predictions?.[`units_sold_${suffix}`]
  );

  const risk = metricValue(
    predictions?.never_breaks_even
  );

  const steps = [
    {
      title:
        profit !== null && profit < 0
          ? "Investigate the potential loss"
          : "Check whether your pricing covers your costs",

      description:
        profit !== null && profit < 0
          ? `The ${period === "12m" ? "12-month" : "24-month"} forecast shows an estimated loss of ${formatMoney(Math.abs(profit))}. List your expected production, delivery, and selling costs, then compare them with your proposed price.`
          : margin !== null && margin > 0
            ? `The estimated profit margin is ${margin.toFixed(1)}%. Confirm your own costs, including expenses that may not be reflected in the forecast, before deciding whether that margin is sufficient.`
            : "Estimate how much each sale will cost you, including production, shipping, fees, and marketing. Compare the total with your planned price.",
    },

    {
      title: "Check whether customers want this product",

      description:
        units !== null
          ? `The forecast estimates ${formatNumber(units)} units sold over the first ${period === "12m" ? "12" : "24"} months. Compare that estimate with competitor activity, customer feedback, or a small product test.`
          : "Speak with potential customers and look at competing products to understand demand before committing to inventory.",
    },

    {
      title:
        risk !== null && risk >= 50
          ? "Keep the initial investment manageable"
          : "Decide how much you can afford to risk",

      description:
        risk !== null && risk >= 50
          ? `The reported chance of not breaking even is ${risk.toFixed(1)}%. Consider a small test or limited first order before committing more money.`
          : "Set a budget for testing the idea. Decide what sales or customer response would justify a larger investment.",
    },
  ];

  return (
    <section className="mt-14">
      <SectionHeading
        number="07"
        eyebrow="Your next decisions"
        title="What should you do before launching?"
        description="Use the results to choose what to verify before spending money. These suggestions are research steps, not promises of success."
      />

      <div className="mt-7 border border-ink bg-card p-6 shadow-offset sm:p-8">
        <div className="space-y-6">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex items-start gap-4 border-b border-border pb-6 last:border-b-0 last:pb-0"
            >
              <span className="flex size-9 shrink-0 items-center justify-center border border-ink bg-[#F8EEE0] font-mono text-xs">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div>
                <h3 className="text-sm font-semibold">
                  {step.title}
                </h3>

                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ========================================
// FORECAST INFORMATION
// ========================================

function AboutForecast({ notes }) {
  return (
    <InfoDialog
      triggerLabel="About this launch forecast"
      title="About this forecast"
      closeButtonClassName={primaryButton}
    >
            <p className="mt-6 text-sm leading-7 text-muted-foreground">
              This forecast estimates potential
              business performance over the first
              12 and 24 months after launch.
            </p>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              These estimates use simulated U.S. market
              information. They are not verified sales
              results for this specific product.
              Actual sales and financial performance
              may differ significantly.
            </p>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              The ranges show how much estimates may
              vary based on earlier evaluations. They
              are not guaranteed best- or worst-case results.
            </p>

            {Array.isArray(notes) &&
              notes.length > 0 && (
                <div className="mt-6 border-l-2 border-primary bg-[#F8EEE0] p-4">
                  <p className="font-semibold">
                    Additional forecast information
                  </p>

                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                    {notes.map((note, index) => (
                      <li key={index}>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
    </InfoDialog>
  );
}

// ========================================
// MAIN PAGE
// ========================================

export default function LaunchForecastOverview({
  forecast,
}) {
  const [period, setPeriod] = useState("12m");

  const launch =
    forecast?.type === "launch"
      ? forecast.launch
      : null;

  const predictions = launch?.predictions;

  const product =
    forecast?.product ||
    launch?.input ||
    {};

  // ========================================
  // EMPTY STATE
  // ========================================

  if (!predictions) {
    return (
      <main className="min-h-screen bg-background px-6 py-20 text-center text-foreground">
        <h1 className="font-display text-4xl">
          No launch forecast available.
        </h1>

        <p className="mt-4 text-muted-foreground">
          Generate a forecast to explore the
          potential performance of your product.
        </p>

        <Link
          to="/discover"
          className={`mt-8 ${primaryButton}`}
        >
          Return to Discovery
          <ArrowRight size={17} />
        </Link>
      </main>
    );
  }

  const suffix =
    period === "12m" ? "12m" : "24m";

  const months =
    period === "12m" ? 12 : 24;

  const selectedMetric = (name) =>
    predictions[`${name}_${suffix}`];

  // ========================================
  // RESULTS PAGE
  // ========================================

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 lg:pt-16">
        <Link
          to="/discover"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back to Discovery
        </Link>

        {/* PAGE HEADER */}

        <header className="mt-10 border-b border-ink pb-10">
          <p className="eyebrow flex items-center gap-3 text-muted-foreground">
            <span className="text-primary">
              02
            </span>

            <span className="h-px w-8 bg-current" />

            New product launch
          </p>

          <h1 className="mt-6 font-display text-5xl leading-tight sm:text-6xl">
            Your launch{" "}
            <em className="text-primary">
              outlook.
            </em>
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Explore what your product could
            earn, how much demand there may be,
            and what to consider before launching.
          </p>

          <div className="mt-8 border-l-2 border-primary pl-5">
            <p className="eyebrow text-muted-foreground">
              Proposed product
            </p>

            <h2 className="mt-2 break-words font-display text-2xl">
              {product.name || "Your product"}
            </h2>

            <div className="mt-4 flex flex-wrap gap-3">
              {product.category && (
                <span className="border border-ink bg-card px-3 py-2 text-xs">
                  {product.category}
                </span>
              )}

              {numeric(product.price) !== null && (
                <span className="border border-ink bg-card px-3 py-2 text-xs">
                  Planned price:{" "}
                  {formatMoney(product.price)}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* TIMEFRAME SELECTOR */}

        <section className="mt-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-primary">
              Forecast period
            </p>

            <p className="mt-3 font-display text-2xl">
              First {months} months
            </p>
          </div>

          <div
            role="group"
            aria-label="Forecast period"
            className="flex border border-ink bg-card p-1"
          >
            {[
              {
                value: "12m",
                label: "12 months",
              },
              {
                value: "24m",
                label: "24 months",
              },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setPeriod(option.value)
                }
                aria-pressed={
                  period === option.value
                }
                className={
                  "px-5 py-3 text-sm font-semibold transition-colors " +
                  (period === option.value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-[#F8EEE0]")
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {/* PRIMARY FINANCIAL RESULTS */}

        <section className="mt-12">
          <SectionHeading
            number="01"
            eyebrow="Financial outlook"
            title="What could your product earn?"
            description={`These figures estimate total performance across the first ${months} months after launch.`}
          />

          <div className="mt-7 grid gap-5 md:grid-cols-3">
            <MetricCard
              label="Projected revenue"
              metric={selectedMetric("revenue")}
              description="Total estimated sales before costs."
              featured
            />

            <MetricCard
              label="Projected net profit"
              metric={selectedMetric("profit")}
              description="What may remain from sales after estimated expenses."
            />

            <MetricCard
              label="Units sold"
              metric={selectedMetric("units_sold")}
              description="Estimated number of products sold."
            />
          </div>
        </section>

        {/* INITIAL BUSINESS TAKEAWAY */}

        <section className="mt-6 border-l-2 border-primary bg-[#F8EEE0] p-6">
          <p className="font-semibold">
            What do these numbers suggest?
          </p>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {metricValue(selectedMetric("profit")) === null
              ? "An estimated profit is not available for this period. Review your expected costs and sales before making a launch decision."
              : metricValue(selectedMetric("profit")) < 0
                ? `The forecast shows a potential loss of ${formatMoney(Math.abs(metricValue(selectedMetric("profit"))))} over the first ${months} months. Review your planned price, costs, and the level of customer interest before investing.`
                : metricValue(selectedMetric("profit")) > 0
                  ? `The forecast shows a potential profit of ${formatMoney(metricValue(selectedMetric("profit")))} over the first ${months} months. This is worth investigating, but the estimate does not confirm that customers will buy at the expected price.`
                  : "The forecast suggests little or no net profit over this period. Review your costs and selling price before proceeding."}
          </p>
        </section>

        {/* REVENUE AND PROFIT COMPARISONS */}

        <section className="mt-14">
          <SectionHeading
            number="02"
            eyebrow="Financial comparisons"
            title="See the bigger picture."
            description="Compare how estimated revenue and profit could accumulate over the first one and two years."
          />

          <div className="mt-7 grid items-start gap-5 lg:grid-cols-2">
            <CumulativeComparison
              predictions={predictions}
              field="revenue"
              title="How could revenue change?"
              description="Estimated total revenue across the first 12 and 24 months."
              footnote="The 24-month total includes the first 12 months. It is not additional second-year revenue."
            />

            <CumulativeComparison
              predictions={predictions}
              field="profit"
              title="How could profit change?"
              description="Estimated net profit accumulated across the first 12 and 24 months."
              footnote="These are cumulative estimates, not separate yearly profit figures. A negative value indicates an estimated loss."
            />
          </div>
        </section>

        {/* PROFITABILITY */}

        <ProfitabilitySection
          predictions={predictions}
          suffix={suffix}
          period={months}
        />

        {/* BREAK-EVEN */}

        <InvestmentOutlook
          predictions={predictions}
        />

        {/* DEMAND */}

        <DemandSection
          predictions={predictions}
        />

        {/* ADDITIONAL DETAILS */}

        <AdditionalDetails
          predictions={predictions}
          product={product}
        />

        {/* BUSINESS GUIDANCE */}

        <NextSteps
          predictions={predictions}
          period={period}
        />

        {/* NAVIGATION */}

        <section className="mt-14 flex flex-col items-start justify-between gap-5 border-t border-ink pt-8 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow text-primary">
              Continue exploring
            </p>

            <h2 className="mt-3 font-display text-2xl">
              Have another product in mind?
            </h2>

            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Explore other product ideas before
              deciding where to invest your time
              and resources.
            </p>
          </div>

          <Link
            to="/discover"
            className={primaryButton}
          >
            Explore another product
            <ArrowRight size={18} />
          </Link>
        </section>

        <AboutForecast
          notes={launch?.notes}
        />

        <div className="mt-8 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
          <CircleHelp
            size={15}
            className="mt-0.5 shrink-0"
          />

          <span>
            These results are estimates intended
            to support business research, not
            guarantees of sales, profitability,
            or investment returns.
          </span>
        </div>
      </div>
    </main>
  );
}
