
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  rescoreProduct,
  simulatePrices,
} from "../services/marketlensApi";

// ========================================
// DESIGN SYSTEM
// ========================================

const COLORS = {
  orange: "#D95332",
  green: "#47866B",
  ink: "#1D150F",
  muted: "#645850", // = --muted-foreground; #776C61 was 4.46:1 on the beige panels
  cream: "#F8EEE0",
  background: "#F8F3EA",
  gray: "#AFA49A",
  grid: "#E8DED2",
  red: "#B94747",
};

const DEFAULT_COSTS = {
  units: "500",
  manufacturing: "7.50",
  shipping: "2.00",
  amazonFees: "5.00",
  advertising: "3.00",
};

const COST_FIELDS = [
  {
    id: "manufacturing",
    label: "Manufacturing",
    description: "Production cost per unit",
    color: COLORS.orange,
  },
  {
    id: "shipping",
    label: "Shipping",
    description: "Shipping cost per unit",
    color: "#D9A376",
  },
  {
    id: "amazonFees",
    label: "Amazon fees",
    description: "Marketplace fees per unit",
    color: COLORS.green,
  },
  {
    id: "advertising",
    label: "Advertising",
    description: "Advertising cost per unit",
    color: COLORS.ink,
  },
];

const primaryButton =
  "inline-flex items-center justify-center gap-3 " +
  "border border-ink bg-primary px-6 py-3 " +
  "text-sm font-semibold text-primary-foreground " +
  "shadow-offset transition-transform duration-150 " +
  "hover:translate-x-[2px] hover:translate-y-[2px] " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 " +
  "focus-visible:outline-primary disabled:cursor-not-allowed " +
  "disabled:opacity-50 disabled:hover:translate-x-0 " +
  "disabled:hover:translate-y-0";

const secondaryButton =
  "inline-flex items-center justify-center gap-2 " +
  "border border-ink bg-card px-4 py-2.5 " +
  "text-sm font-semibold text-foreground " +
  "transition-colors hover:bg-[#F8EEE0] " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 " +
  "focus-visible:outline-primary";

// ========================================
// FORMATTING
// ========================================

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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
    value === "" ||
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return Number(value);
}

function formatMoney(value) {
  const number = numeric(value);

  return number === null
    ? "—"
    : moneyFormatter.format(number);
}

function formatNumber(value) {
  const number = numeric(value);

  return number === null
    ? "—"
    : numberFormatter.format(number);
}

function formatPercent(value) {
  const number = numeric(value);

  return number === null
    ? "—"
    : `${number.toFixed(1)}%`;
}

function signedMoney(value) {
  const number = numeric(value);

  if (number === null) return "—";

  return `${
    number > 0 ? "+" : number < 0 ? "−" : ""
  }${formatMoney(Math.abs(number))}`;
}

function signedPercent(value) {
  const number = numeric(value);

  if (number === null) return "—";

  return `${
    number > 0 ? "+" : ""
  }${number.toFixed(1)}%`;
}

function validSuggestedPrice(value) {
  const number = numeric(value);

  return number !== null &&
    number > 0 &&
    number <= 100000
    ? number
    : null;
}

// ========================================
// FINANCIAL CALCULATIONS
// ========================================

function calculateFinancials(values) {
  const unitCost =
    values.manufacturing +
    values.shipping +
    values.amazonFees +
    values.advertising;

  const revenue = values.price * values.units;
  const totalCosts = unitCost * values.units;
  const profit = revenue - totalCosts;

  const margin =
    revenue > 0
      ? (profit / revenue) * 100
      : 0;

  const roi =
    totalCosts > 0
      ? (profit / totalCosts) * 100
      : null;

  return {
    unitCost,
    revenue,
    totalCosts,
    profit,
    margin,
    roi,
    contributionPerUnit: values.price - unitCost,
  };
}

// ========================================
// SECTION HEADING
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
        <span className="text-primary">
          {number}
        </span>

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

// ========================================
// SHARED WORKSPACE HEADER
// ========================================

function WorkspaceHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
}) {
  return (
    <div className="flex min-h-[118px] flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="eyebrow text-primary">
            {eyebrow}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3">
          {Icon && (
            <Icon
              size={19}
              color={COLORS.orange}
              className="shrink-0"
              aria-hidden="true"
            />
          )}

          <h3 className="font-display text-2xl leading-tight">
            {title}
          </h3>
        </div>

        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          {description}
        </p>
      </div>

      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}

// ========================================
// SCENARIO CONTROL
// ========================================

function ScenarioControl({
  id,
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  prefix = "",
}) {
  const parsed = numeric(value);

  const sliderValue =
    parsed === null
      ? min
      : Math.max(min, Math.min(max, parsed));

  const valid =
    parsed !== null &&
    parsed >= min &&
    parsed <= 100000 &&
    (step !== 1 || Number.isSafeInteger(parsed));

  const maximumLabel =
    step === 1
      ? formatNumber(max)
      : Number(max).toFixed(2);

  return (
    <div className="flex min-w-0 flex-col border border-border bg-card p-4">
      <div className="grid min-h-[64px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0 self-center">
          <label
            htmlFor={id}
            className="block text-sm font-semibold leading-5"
          >
            {label}
          </label>

          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5">
          {prefix && (
            <span className="text-xs text-muted-foreground">
              {prefix}
            </span>
          )}

          <input
            id={id}
            type="number"
            value={value}
            min={min}
            max={100000}
            step={step}
            onChange={(event) =>
              onChange(event.target.value)
            }
            aria-invalid={!valid}
            className={
              "h-10 w-24 border bg-background px-2 " +
              "text-right font-mono text-sm " +
              "focus:outline-2 focus:outline-primary " +
              (valid
                ? "border-ink"
                : "border-red-600")
            }
          />
        </div>
      </div>

      <div className="mt-4">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={sliderValue}
          disabled={max <= min}
          aria-label={`${label} slider`}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="block w-full cursor-pointer accent-[#D95332] disabled:cursor-not-allowed"
        />

        <div className="mt-1 flex justify-between gap-3 font-mono text-[10px] text-muted-foreground">
          <span>
            {prefix}
            {step === 1
              ? formatNumber(min)
              : Number(min).toFixed(2)}
          </span>

          <span>
            {prefix}
            {maximumLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// ========================================
// CHART TOOLTIP
// ========================================

function ChartTooltip({
  active,
  payload,
  unit = "USD",
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];

  const display =
    unit === "USD"
      ? formatMoney(item.value)
      : unit === "%"
        ? formatPercent(item.value)
        : formatNumber(item.value);

  return (
    <div className="border border-ink bg-card px-4 py-3 shadow-offset">
      <p className="text-sm font-semibold">
        {item.payload?.name || item.name}
      </p>

      <p className="mt-2 font-mono text-sm">
        {display}
      </p>
    </div>
  );
}

// ========================================
// REVENUE VS COSTS CHART
// ========================================

function RevenueCostChart({ financials }) {
  const data = [
    {
      name: "Revenue",
      value: financials.revenue,
      color: COLORS.orange,
    },
    {
      name: "Costs",
      value: financials.totalCosts,
      color: COLORS.green,
    },
  ];

  return (
    <div
      className="h-[190px] w-full"
      role="img"
      aria-label={`Scenario revenue ${formatMoney(
        financials.revenue
      )}. Variable costs ${formatMoney(
        financials.totalCosts
      )}.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 12,
            right: 8,
            bottom: 0,
            left: 0,
          }}
        >
          <CartesianGrid
            vertical={false}
            stroke={COLORS.grid}
          />

          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{
              fill: COLORS.muted,
              fontSize: 11,
            }}
          />

          <YAxis
            domain={[0, "auto"]}
            axisLine={false}
            tickLine={false}
            width={58}
            tick={{
              fill: COLORS.muted,
              fontSize: 10,
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
            maxBarSize={64}
          >
            {data.map((item) => (
              <Cell
                key={item.name}
                fill={item.color}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ========================================
// LIVE METRIC
// ========================================

function LiveMetric({
  label,
  value,
  featured = false,
  negative = false,
}) {
  return (
    <div
      className={
        "flex min-h-[102px] min-w-0 flex-col " +
        "justify-between border border-border p-3 " +
        (featured
          ? "bg-[#F8EEE0]"
          : "bg-background")
      }
    >
      <p className="text-[11px] leading-4 text-muted-foreground">
        {label}
      </p>

      <p
        className={
          "mt-3 break-words font-display text-xl leading-tight sm:text-2xl " +
          (negative
            ? "text-signal-down"
            : "text-foreground")
        }
      >
        {value}
      </p>
    </div>
  );
}

// ========================================
// STICKY LIVE RESULTS
// ========================================

function LiveResults({
  financials,
  isValid,
  units,
  price,
}) {
  return (
    <aside className="min-w-0 lg:sticky lg:top-24">
      <div className="border border-ink bg-card p-5 shadow-offset-sm sm:p-6">
        <WorkspaceHeader
          eyebrow="Live results"
          title="Your scenario."
          description="Recalculates as you adjust the inputs."
        />

        <div
          className="mt-5 grid grid-cols-2 gap-3"
          aria-live="polite"
          aria-atomic="true"
        >
          <LiveMetric
            label="Monthly revenue"
            value={
              isValid
                ? formatMoney(financials.revenue)
                : "—"
            }
          />

          <LiveMetric
            label="Variable costs"
            value={
              isValid
                ? formatMoney(financials.totalCosts)
                : "—"
            }
          />

          <LiveMetric
            label="Profit after variable costs"
            value={
              isValid
                ? formatMoney(financials.profit)
                : "—"
            }
            featured
            negative={
              isValid && financials.profit < 0
            }
          />

          <LiveMetric
            label="Profit margin"
            value={
              isValid
                ? formatPercent(financials.margin)
                : "—"
            }
          />
        </div>

        {isValid ? (
          <>
            <div className="mt-4 border-t border-border pt-3">
              <RevenueCostChart
                financials={financials}
              />
            </div>

            <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>
                Price: {formatMoney(price)}
              </span>

              <span>
                Units: {formatNumber(units)}
              </span>
            </div>
          </>
        ) : (
          <div
            role="status"
            className="mt-4 border-l-2 border-red-600 bg-red-50 p-4 text-xs leading-6 text-red-700"
          >
            Enter valid assumptions to calculate
            the financial results.
          </div>
        )}
      </div>
    </aside>
  );
}

// ========================================
// MOBILE LIVE RESULTS
// ========================================

function MobileLiveSummary({
  financials,
  isValid,
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-[#F8F3EA] px-4 py-3 shadow-[0_-6px_20px_rgba(29,21,15,0.10)] lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Monthly profit after variable costs
          </p>

          <p
            className={
              "mt-1 font-display text-xl " +
              (isValid && financials.profit < 0
                ? "text-signal-down"
                : "text-foreground")
            }
          >
            {isValid
              ? formatMoney(financials.profit)
              : "—"}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">
            Margin
          </p>

          <p className="mt-1 font-display text-lg">
            {isValid
              ? formatPercent(financials.margin)
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ========================================
// COST BREAKDOWN
// ========================================

function CostBreakdown({ values }) {
  const items = COST_FIELDS.map((field) => ({
    ...field,
    amount:
      values[field.id] * values.units,
  }));

  const total = items.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  return (
    <div className="flex h-full min-w-0 flex-col border border-ink bg-card p-6 sm:p-8">
      <h3 className="font-display text-2xl">
        Where do the variable costs go?
      </h3>

      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        Breakdown of your monthly costs.
      </p>

      <div
        className="mt-6 flex h-7 w-full overflow-hidden border border-ink bg-background"
        role="img"
        aria-label={items
          .map(
            (item) =>
              `${item.label}: ${formatMoney(item.amount)}`
          )
          .join(". ")}
      >
        {total > 0 &&
          items.map((item) => (
            <div
              key={item.id}
              style={{
                width: `${(item.amount / total) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          ))}
      </div>

      <div className="mt-5 grid flex-1 auto-rows-fr gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const share =
            total > 0
              ? (item.amount / total) * 100
              : 0;

          return (
            <div
              key={item.id}
              className="flex min-w-0 flex-col border border-border bg-background p-4"
            >
              <div className="flex min-h-[40px] items-start gap-2">
                <span
                  className="mt-1 h-3 w-3 shrink-0"
                  style={{
                    backgroundColor: item.color,
                  }}
                />

                <span className="text-xs leading-5 text-muted-foreground">
                  {item.label}
                </span>
              </div>

              <div className="mt-auto pt-3">
                <p className="break-words font-display text-xl leading-tight">
                  {formatMoney(item.amount)}
                </p>

                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {share.toFixed(1)}% of costs
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========================================
// FINANCIAL DETAILS
// ========================================

function DetailRow({
  label,
  value,
  negative = false,
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-b-0">
      <span className="text-sm text-muted-foreground">
        {label}
      </span>

      <span
        className={
          "text-right text-sm font-semibold " +
          (negative
            ? "text-signal-down"
            : "text-foreground")
        }
      >
        {value}
      </span>
    </div>
  );
}

// ========================================
// SCENARIO COMPARISON
// ========================================

function ScenarioComparison({
  baseline,
  financials,
  originalPrice,
  currentPrice,
}) {
  if (!baseline || !financials) {
    return (
      <div className="mt-6 border border-ink bg-card p-6">
        <p className="text-sm text-muted-foreground">
          An original product price and valid
          assumptions are required for comparison.
        </p>
      </div>
    );
  }

  const metrics = [
    {
      label: "Monthly revenue",
      original: baseline.revenue,
      current: financials.revenue,
      format: formatMoney,
    },
    {
      label: "Monthly contribution",
      original: baseline.profit,
      current: financials.profit,
      format: formatMoney,
    },
    {
      label: "Contribution margin",
      original: baseline.margin,
      current: financials.margin,
      format: formatPercent,
    },
  ];

  const priceChange =
    originalPrice > 0
      ? ((currentPrice / originalPrice) - 1) * 100
      : null;

  return (
    <>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {metrics.map((item, index) => {
          const difference =
            item.current - item.original;

          return (
            <article
              key={item.label}
              className={
                "border border-ink p-5 " +
                (index === 0
                  ? "bg-[#F8EEE0]"
                  : "bg-card")
              }
            >
              <p className="eyebrow text-muted-foreground">
                {item.label}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Original
                  </p>

                  <p className="mt-2 break-words font-display text-xl">
                    {item.format(item.original)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Adjusted
                  </p>

                  <p className="mt-2 break-words font-display text-xl">
                    {item.format(item.current)}
                  </p>
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <p
                  className="text-sm font-semibold"
                  style={{
                    color:
                      difference > 0
                        ? COLORS.green
                        : difference < 0
                          ? COLORS.red
                          : COLORS.muted,
                  }}
                >
                  {item.label === "Contribution margin"
                    ? signedPercent(difference)
                    : signedMoney(difference)}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Difference
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-5 border border-ink bg-[#F8EEE0] p-5">
        <div>
          <p className="eyebrow text-muted-foreground">
            Price change
          </p>

          <p className="mt-2 font-display text-3xl">
            {signedPercent(priceChange)}
          </p>
        </div>

        <div className="text-sm leading-7">
          <p>
            Original:{" "}
            <strong>
              {formatMoney(originalPrice)}
            </strong>
          </p>

          <p>
            Adjusted:{" "}
            <strong>
              {formatMoney(currentPrice)}
            </strong>
          </p>
        </div>
      </div>
    </>
  );
}

// ========================================
// AI PRICE SIMULATION
// ========================================

function AIPriceSimulation({
  product,
  prediction,
  isValid,
  loading,
  error,
  rescore,
  simulations,
  onRun,
}) {
  const initialScore = numeric(
    prediction?.opportunity_score
  );

  const updatedScore = numeric(
    rescore?.opportunity_score
  );

  const scoreChange = numeric(
    rescore?.score_change
  );

  const chartData = Array.isArray(simulations)
    ? simulations
        .map((item) => ({
          price: numeric(item.price),
          score: numeric(item.opportunity_score),
          probability: numeric(item.probability),
        }))
        .filter(
          (item) =>
            item.price !== null &&
            item.score !== null
        )
    : [];

  return (
    <section className="mt-14">
      <SectionHeading
        number="04"
        eyebrow="Model analysis"
        title="How might price affect the opportunity score?"
        description="Compare opportunity scores for nearby selling prices."
      />

      <div className="mt-7 border border-ink bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-xl">
            <p className="font-semibold">
              Compare nearby prices
            </p>

            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Evaluate prices approximately 10%
              below, equal to, and 10% above your
              selected scenario price.
            </p>
          </div>

          <button
            type="button"
            disabled={
              !isValid ||
              loading ||
              !product ||
              !prediction
            }
            onClick={onRun}
            className={primaryButton}
          >
            {loading ? (
              "Simulating..."
            ) : (
              <>
                <Play size={17} />
                Run simulation
              </>
            )}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 border border-red-600 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {rescore && (
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              {
                label: "Original score",
                value:
                  initialScore === null
                    ? "—"
                    : `${initialScore}/100`,
              },
              {
                label: "Recalculated score",
                value:
                  updatedScore === null
                    ? "—"
                    : `${updatedScore}/100`,
              },
              {
                label: "Score difference",
                value:
                  scoreChange === null
                    ? "—"
                    : `${
                        scoreChange > 0 ? "+" : ""
                      }${scoreChange}`,
              },
            ].map((item, index) => (
              <div
                key={item.label}
                className={
                  "border border-ink p-5 " +
                  (index === 0
                    ? "bg-[#F8EEE0]"
                    : "bg-background")
                }
              >
                <p className="eyebrow text-muted-foreground">
                  {item.label}
                </p>

                <p className="mt-4 font-display text-3xl">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {chartData.length > 0 && (
          <div className="mt-8">
            <h3 className="font-display text-2xl">
              Price sensitivity
            </h3>

            <p className="mt-3 text-sm text-muted-foreground">
              Opportunity scores returned by
              the product scoring model.
            </p>

            <div
              className="mt-5 h-[260px] w-full"
              role="img"
              aria-label={chartData
                .map(
                  (item) =>
                    `${formatMoney(item.price)}: score ${item.score}`
                )
                .join(". ")}
            >
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={chartData}
                  margin={{
                    top: 12,
                    right: 12,
                    bottom: 0,
                    left: 0,
                  }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke={COLORS.grid}
                  />

                  <XAxis
                    dataKey="price"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: COLORS.muted,
                      fontSize: 11,
                    }}
                    tickFormatter={formatMoney}
                  />

                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: COLORS.muted,
                      fontSize: 11,
                    }}
                  />

                  <Tooltip
                    content={({
                      active,
                      payload,
                    }) => {
                      if (
                        !active ||
                        !payload?.length
                      ) {
                        return null;
                      }

                      const item =
                        payload[0].payload;

                      return (
                        <div className="border border-ink bg-card px-4 py-3 shadow-offset">
                          <p className="font-semibold">
                            {formatMoney(item.price)}
                          </p>

                          <p className="mt-2 text-sm">
                            Score: {item.score}/100
                          </p>
                        </div>
                      );
                    }}
                  />

                  <Bar
                    dataKey="score"
                    maxBarSize={85}
                    fill={COLORS.orange}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[430px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink text-muted-foreground">
                    <th className="py-3 pr-4 font-semibold">
                      Price
                    </th>

                    <th className="py-3 pr-4 font-semibold">
                      Score
                    </th>

                    <th className="py-3 font-semibold">
                      Model probability
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {chartData.map((item, index) => (
                    <tr
                      key={`${item.price}-${index}`}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="py-4 pr-4">
                        {formatMoney(item.price)}
                      </td>

                      <td className="py-4 pr-4 font-semibold">
                        {item.score}/100
                      </td>

                      <td className="py-4">
                        {item.probability !== null &&
                        item.probability >= 0 &&
                        item.probability <= 1
                          ? formatPercent(
                              item.probability * 100
                            )
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          !rescore &&
          chartData.length === 0 && (
            <div className="mt-7 border border-dashed border-border bg-background p-7 text-center">
              <p className="font-display text-2xl">
                Ready to compare prices?
              </p>

              <p className="mt-3 text-sm text-muted-foreground">
                Run the simulation to view
                opportunity scores at nearby prices.
              </p>
            </div>
          )}
      </div>
    </section>
  );
}

// ========================================
// MAIN PAGE
// ========================================

export default function LaunchFeasibility({
  product,
  prediction,
}) {
  const location = useLocation();

  const originalPrice = numeric(
    product?.price
  );

  const suggestedPrice = validSuggestedPrice(
    location.state?.suggestedPrice
  );

  const startingPrice =
    suggestedPrice ?? originalPrice;

  const [scenario, setScenario] = useState(() => ({
    price:
      startingPrice === null
        ? ""
        : String(startingPrice),
    ...DEFAULT_COSTS,
  }));

  const [rescore, setRescore] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestVersion = useRef(0);

  // ========================================
  // CLEAN UP ASYNC REQUESTS
  // ========================================

  useEffect(() => {
    return () => {
      requestVersion.current += 1;
    };
  }, []);

  function resetResults() {
    requestVersion.current += 1;

    setRescore(null);
    setSimulations([]);
    setLoading(false);
    setError("");
  }

  function updateField(field, value) {
    setScenario((previous) => ({
      ...previous,
      [field]: value,
    }));

    resetResults();
  }

  function resetAssumptions() {
    setScenario({
      price:
        originalPrice === null
          ? ""
          : String(originalPrice),
      ...DEFAULT_COSTS,
    });

    resetResults();
  }

  // ========================================
  // INPUT VALIDATION
  // ========================================

  const values = Object.fromEntries(
    Object.entries(scenario).map(
      ([key, value]) => [
        key,
        numeric(value),
      ]
    )
  );

  const isValid =
    Object.values(values).every(
      (value) =>
        value !== null &&
        value >= 0 &&
        value <= 100000
    ) &&
    values.price > 0 &&
    Number.isSafeInteger(values.units);

  const financials = isValid
    ? calculateFinancials(values)
    : null;

  const baselineValues =
    isValid &&
    originalPrice !== null &&
    originalPrice > 0
      ? {
          ...values,
          price: originalPrice,
        }
      : null;

  const baseline = baselineValues
    ? calculateFinancials(baselineValues)
    : null;

  // ========================================
  // SLIDER LIMITS
  // ========================================

  const priceSliderMax = Math.min(
    100000,
    Math.max(
      10,
      (originalPrice ?? 0) * 1.5,
      (values.price ?? 0) * 1.2
    )
  );

  const unitSliderMax = Math.min(
    100000,
    Math.max(
      1000,
      (values.units ?? 0) * 1.2
    )
  );

  function costSliderMax(field) {
    return Math.min(
      100000,
      Math.max(
        25,
        (values[field] ?? 0) * 1.4
      )
    );
  }

  // ========================================
  // AI PRICE SIMULATION
  // ========================================

  async function runSimulation() {
    if (
      !product ||
      !prediction ||
      !isValid ||
      loading
    ) {
      return;
    }

    const version = ++requestVersion.current;

    setLoading(true);
    setError("");
    setRescore(null);
    setSimulations([]);

    const selectedPrice = values.price;

    const prices = [
      selectedPrice * 0.9,
      selectedPrice,
      selectedPrice * 1.1,
    ].map((price) =>
      Math.min(
        100000,
        Math.max(
          0.01,
          Number(price.toFixed(2))
        )
      )
    );

    try {
      const [scoreResponse, simulationResponse] =
        await Promise.all([
          rescoreProduct(product, {
            price: selectedPrice,
          }),
          simulatePrices(product, prices),
        ]);

      if (version !== requestVersion.current) {
        return;
      }

      setRescore(scoreResponse);

      setSimulations(
        Array.isArray(simulationResponse)
          ? simulationResponse
          : []
      );
    } catch (err) {
      if (version !== requestVersion.current) {
        return;
      }

      setError(
        err?.message ||
          "Unable to complete the price simulation."
      );
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
      }
    }
  }

  // ========================================
  // EMPTY STATE
  // ========================================

  if (!product || !prediction) {
    return (
      <main className="min-h-screen bg-background px-6 py-20 text-foreground">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-4xl">
            No product analysis available.
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            Select and analyze a product before
            using Launch Feasibility.
          </p>

          <Link
            to="/discover"
            className={`mt-8 ${primaryButton}`}
          >
            Discover products
            <ArrowRight size={18} />
          </Link>
        </div>
      </main>
    );
  }

  // ========================================
  // PAGE CONTENT
  // ========================================

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 pb-32 pt-12 sm:px-8 lg:pb-24 lg:pt-16">
        {/* BACK NAVIGATION */}

        <Link
          to="/product-overview"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back to Product Overview
        </Link>

        {/* PAGE HEADER */}

        <header className="mt-10 border-b border-ink pb-9">
          <p className="eyebrow flex items-center gap-3 text-muted-foreground">
            <span className="text-primary">
              03
            </span>

            <span className="h-px w-8 bg-current" />

            Launch feasibility
          </p>

          <h1 className="mt-6 font-display text-5xl leading-tight sm:text-6xl">
            Explore different{" "}
            <em className="text-primary">
              possibilities.
            </em>
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Adjust selling prices and costs.
            See the financial impact immediately
            without leaving your assumptions.
          </p>

          <div className="mt-7 border-l-2 border-primary pl-5">
            <p className="eyebrow text-muted-foreground">
              Evaluated product
            </p>

            <h2 className="mt-2 break-words font-display text-2xl">
              {product.title ||
                product.name ||
                "Selected product"}
            </h2>

            <div className="mt-4 flex flex-wrap gap-3">
              {originalPrice !== null && (
                <span className="border border-ink bg-card px-3 py-2 text-xs">
                  Original price:{" "}
                  {formatMoney(originalPrice)}
                </span>
              )}

              {numeric(prediction.opportunity_score) !== null && (
                <span className="border border-ink bg-card px-3 py-2 text-xs">
                  Opportunity score:{" "}
                  {formatNumber(
                    prediction.opportunity_score
                  )}
                  /100
                </span>
              )}
            </div>
          </div>
        </header>

        {/* ====================================
            01 — SCENARIO WORKSPACE
        ==================================== */}

        <section className="mt-12">
          <SectionHeading
            number="01"
            eyebrow="Scenario builder"
            title="Adjust your assumptions."
            description="Change a value on the left and see the financial results on the right."
          />

          <div className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            {/* LEFT — SCENARIO INPUTS */}

            <div className="min-w-0 border border-ink bg-card p-5 sm:p-6">
              <WorkspaceHeader
                title="Scenario inputs"
                description="Adjust values using the sliders or number fields."
                icon={SlidersHorizontal}
                action={
                  <button
                    type="button"
                    onClick={resetAssumptions}
                    className={secondaryButton}
                  >
                    <RotateCcw size={15} />
                    Reset
                  </button>
                }
              />

              <div className="mt-5 space-y-3">
                <ScenarioControl
                  id="scenario-price"
                  label="Selling price"
                  description="Price for each unit"
                  value={scenario.price}
                  onChange={(value) =>
                    updateField("price", value)
                  }
                  min={0.01}
                  max={priceSliderMax}
                  step={0.01}
                  prefix="$"
                />

                <ScenarioControl
                  id="scenario-units"
                  label="Monthly units sold"
                  description="Assumed unit sales per month"
                  value={scenario.units}
                  onChange={(value) =>
                    updateField("units", value)
                  }
                  min={0}
                  max={unitSliderMax}
                  step={1}
                />
              </div>

              <div className="mt-7 border-t border-border pt-5">
                <p className="eyebrow text-muted-foreground">
                  Costs per unit
                </p>

                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  Adjust your manufacturing, shipping,
                  marketplace, and advertising costs.
                </p>
              </div>

              <div className="mt-4 grid gap-3">
                {COST_FIELDS.map((field) => (
                  <ScenarioControl
                    key={field.id}
                    id={`scenario-${field.id}`}
                    label={field.label}
                    description={field.description}
                    value={scenario[field.id]}
                    onChange={(value) =>
                      updateField(field.id, value)
                    }
                    min={0}
                    max={costSliderMax(field.id)}
                    step={0.01}
                    prefix="$"
                  />
                ))}
              </div>

              {!isValid && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-3 border-l-2 border-red-600 bg-red-50 p-4"
                >
                  <CircleAlert
                    size={18}
                    className="mt-0.5 shrink-0 text-red-700"
                  />

                  <p className="text-xs leading-6 text-red-700">
                    Enter a positive selling price,
                    nonnegative costs, and a
                    whole-number sales quantity.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT — LIVE RESULTS */}

            <LiveResults
              financials={financials}
              isValid={isValid}
              units={values.units}
              price={values.price}
            />
          </div>
        </section>

        {/* ====================================
            02 — FINANCIAL DETAILS
        ==================================== */}

        <section className="mt-14">
          <SectionHeading
            number="02"
            eyebrow="Financial details"
            title="Understand the numbers."
            description="Explore the calculations behind your scenario and the distribution of monthly costs."
          />

          <div className="mt-7 grid items-stretch gap-5 lg:grid-cols-2">
            <div className="flex h-full flex-col border border-ink bg-card p-6">
              <h3 className="font-display text-2xl">
                Monthly calculations
              </h3>

              <div className="mt-5">
                <DetailRow
                  label="Revenue"
                  value={
                    isValid
                      ? formatMoney(financials.revenue)
                      : "—"
                  }
                />

                <DetailRow
                  label="Variable costs"
                  value={
                    isValid
                      ? formatMoney(financials.totalCosts)
                      : "—"
                  }
                />

                <DetailRow
                  label="Profit after variable costs"
                  value={
                    isValid
                      ? formatMoney(financials.profit)
                      : "—"
                  }
                  negative={
                    isValid && financials.profit < 0
                  }
                />

                <DetailRow
                  label="Profit margin"
                  value={
                    isValid
                      ? formatPercent(financials.margin)
                      : "—"
                  }
                />

                <DetailRow
                  label="Return on variable costs"
                  value={
                    !isValid
                      ? "—"
                      : financials.roi === null
                        ? "N/A"
                        : formatPercent(financials.roi)
                  }
                />

                <DetailRow
                  label="Contribution per unit"
                  value={
                    isValid
                      ? formatMoney(
                          financials.contributionPerUnit
                        )
                      : "—"
                  }
                />

                <DetailRow
                  label="Break-even quantity"
                  value="Not calculated"
                />
              </div>
            </div>

            {isValid ? (
              <CostBreakdown values={values} />
            ) : (
              <div className="border border-ink bg-card p-6">
                <h3 className="font-display text-2xl">
                  Cost breakdown
                </h3>

                <p className="mt-4 text-sm text-muted-foreground">
                  Enter valid assumptions to
                  view the cost breakdown.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ====================================
            03 — PRICE COMPARISON
        ==================================== */}

        <section className="mt-14">
          <SectionHeading
            number="03"
            eyebrow="Scenario comparison"
            title="What changes with a different price?"
            description="Compare the original selling price with your adjusted price using the same monthly sales volume and costs."
          />

          <ScenarioComparison
            baseline={baseline}
            financials={financials}
            originalPrice={originalPrice}
            currentPrice={values.price}
          />
        </section>

        {/* ====================================
            04 — AI PRICE SIMULATION
        ==================================== */}

        <AIPriceSimulation
          product={product}
          prediction={prediction}
          isValid={isValid}
          loading={loading}
          error={error}
          rescore={rescore}
          simulations={simulations}
          onRun={runSimulation}
        />

        {/* ====================================
            05 — BUSINESS GUIDANCE
        ==================================== */}

        <section className="mt-14">
          <SectionHeading
            number="05"
            eyebrow="Your next decisions"
            title="What should you review?"
            description="Use your scenario results to explore the decisions involved in launching a product."
          />

          <div className="mt-7 border border-ink bg-card p-6 sm:p-8">
            <div className="space-y-6">
              {[
                {
                  title: "Review operating costs",
                  description:
                    "Compare production, shipping, marketplace fees, and advertising expenses with your selling price.",
                },
                {
                  title: "Evaluate customer demand",
                  description:
                    "Review customer interest, similar products, and the sales volume needed to support your scenario.",
                },
                {
                  title: "Compare pricing options",
                  description:
                    "Explore alternative selling prices and compare their financial results and opportunity scores.",
                },
              ].map((step, index) => (
                <div
                  key={step.title}
                  className="flex items-start gap-4 border-b border-border pb-6 last:border-b-0 last:pb-0"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center border border-ink bg-[#F8EEE0] font-mono text-xs">
                    {String(index + 1).padStart(
                      2,
                      "0"
                    )}
                  </span>

                  <div>
                    <h3 className="font-semibold">
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
              Compare different product opportunities
              and pricing scenarios.
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
      </div>

      {/* MOBILE LIVE RESULTS */}

      <MobileLiveSummary
        financials={financials}
        isValid={isValid}
      />
    </main>
  );
}
